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

export default function FilterRuleEdit({
    rule,
    setRule,
    group,
    eventName = '',
    controls,
}: Omit<RuleEditProps, 'root' | 'headerPrefix' | 'depth'>) {
    const {
        setReferenceElement,
        setPopperElement,
        attributes,
        styles,
    } = usePopperSelectDropdown()
    const { suggestions } = useContext(VariablesContext)
    const { path } = rule
    const hasValue = rule?.operator && !['is set', 'is not set', 'empty'].includes(rule?.operator)
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
                { hasValue && <TextInput
                    size="small"
                    type="text"
                    name="value"
                    placeholder="Value"
                    disabled={rule.type === 'boolean'}
                    hideLabel={true}
                    value={rule.type === 'boolean' ? 'true' : rule?.value?.toString()}
                    onChange={value => setRule({ ...rule, value })}
                />}
                {controls}
            </ButtonGroup>
        </div>
    )
}
