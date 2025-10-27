import { useContext, useMemo } from 'react'
import { highlightSearch, usePopperSelectDropdown } from '../../../ui/utils'
import { operatorTypes, VariablesContext, RuleEditProps, ruleTypes } from './RuleHelpers'
import { ButtonGroup } from '../../../ui'
import { SingleSelect } from '../../../ui/form/SingleSelect'
import { Combobox } from '@headlessui/react'
import { ChevronUpDownIcon } from '../../../ui/icons'
import clsx from 'clsx'
import TextInput from '../../../ui/form/TextInput'
import { RulePath } from '../../../types'
import { ProjectContext } from '../../../contexts'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'
import { format } from 'date-fns'

export default function FilterRuleEdit({
    rule,
    setRule,
    group,
    eventName = '',
    controls,
}: Omit<RuleEditProps, 'root' | 'headerPrefix' | 'depth'>) {
    const [project] = useContext(ProjectContext)
    const {
        setReferenceElement,
        setPopperElement,
        attributes,
        styles,
    } = usePopperSelectDropdown()
    const { suggestions } = useContext(VariablesContext)
    const { path } = rule
    const hasValue = rule?.operator && !['is set', 'is not set', 'empty', 'not empty'].includes(rule?.operator)
    const isDateRule = rule.type === 'date'
    const isSameDay = rule.operator === 'is same day'

    const getDateInputValue = (): string => {
        if (!rule.value) return ''
        try {
            if (isDateRule && isSameDay) {
                // Accept stored 'YYYY-MM-DD' directly; otherwise format to date in project TZ
                const s = String(rule.value)
                const m = s.match(/^\d{4}-\d{2}-\d{2}/)
                if (m) return m[0]
                const d = new Date(s)
                const zoned = utcToZonedTime(d, project.timezone)
                return format(zoned, 'yyyy-MM-dd')
            }
            // datetime-local expects 'yyyy-MM-ddTHH:mm' in project TZ
            const d = new Date(String(rule.value))
            const zoned = utcToZonedTime(d, project.timezone)
            return format(zoned, "yyyy-MM-dd'T'HH:mm")
        } catch {
            return ''
        }
    }

    const handleDateChange = (value: string) => {
        if (!value) {
            setRule({ ...rule, value: undefined })
            return
        }
        if (isSameDay) {
            // Store as plain 'YYYY-MM-DD' string for day-level comparison
            setRule({ ...rule, value })
            return
        }
        // Interpret naive local value in project timezone and convert to UTC ISO
        try {
            const local = new Date(value)
            const utc = zonedTimeToUtc(local, project.timezone)
            setRule({ ...rule, value: utc.toISOString() })
        } catch {
            setRule({ ...rule, value })
        }
    }
    const pathSuggestions = useMemo<Array<RulePath | string>>(() => {
        const raw: unknown = group === 'event'
            ? (eventName ? suggestions.eventPaths[eventName] ?? [] : [])
            : suggestions.userPaths
        let paths: Array<RulePath | string> = Array.isArray(raw) ? (raw as Array<RulePath | string>) : []

        if (path) {
            let search = path.toLowerCase()
            if (search.startsWith('.')) search = '$' + search
            if (!search.startsWith('$.')) search = '$.' + search
            paths = paths.filter(p => (typeof p === 'string' ? p : p.path).toLowerCase().startsWith(search))
        }

        return paths
    }, [suggestions, group, eventName, path])

    return (
        <div className="rule">
            <ButtonGroup className="ui-select">
                <SingleSelect
                    value={rule.type}
                    onChange={type => setRule({ ...rule, type })}
                    options={ruleTypes}
                    required
                    hideLabel
                    size="small"
                    toValue={x => x.key as typeof rule.type}
                />
                <Combobox onChange={(selected: RulePath | string) => {
                    if (typeof selected === 'string') {
                        setRule({ ...rule, path: selected })
                    } else {
                        const { data_type: type, path } = selected
                        setRule({ ...rule, type, path })
                    }
                }}>
                    <span className="ui-text-input">
                        <Combobox.Input
                            value={rule.path ?? ''}
                            onChange={e => setRule({ ...rule, path: e.target.value })}
                            required
                            className="small"
                            ref={setReferenceElement}
                        />
                    </span>
                    <Combobox.Button className="ui-button small secondary">
                        <ChevronUpDownIcon />
                    </Combobox.Button>
                    <Combobox.Options
                        className="select-options nowheel"
                        ref={setPopperElement}
                        style={styles.popper}
                        {...attributes.popper}
                    >
                        {
                            pathSuggestions.map(s => {
                                const displayPath = typeof s === 'string' ? s : s.path
                                return (
                                    <Combobox.Option
                                        key={displayPath}
                                        value={s}
                                        className={({ active, selected }) => clsx('select-option', active && 'active', selected && 'selected')}
                                    >
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: highlightSearch(displayPath, rule.path ?? ''),
                                            }}
                                        />
                                    </Combobox.Option>
                                )
                            })
                        }
                    </Combobox.Options>
                </Combobox>
                <SingleSelect
                    value={rule.operator}
                    onChange={operator => setRule({ ...rule, operator })}
                    options={operatorTypes[rule.type] ?? []}
                    required
                    hideLabel
                    size="small"
                    toValue={x => x.key}
                />
                { hasValue && (
                    isDateRule
                        ? (
                            <TextInput<string>
                                size="small"
                                type={isSameDay ? 'date' : 'datetime-local'}
                                name="value"
                                placeholder={isSameDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'}
                                hideLabel={true}
                                value={getDateInputValue()}
                                onChange={handleDateChange}
                            />
                        )
                        : (
                            <TextInput
                                size="small"
                                type="text"
                                name="value"
                                placeholder="Value"
                                disabled={rule.type === 'boolean'}
                                hideLabel={true}
                                value={rule.type === 'boolean' ? 'true' : rule?.value?.toString()}
                                onChange={value => setRule({ ...rule, value })}
                            />
                        )
                )}
                {controls}
            </ButtonGroup>
        </div>
    )
}
