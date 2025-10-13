import { useTranslation } from 'react-i18next'
import { TemplateUpdateParams, WebhookTemplateData } from '../../../types'
import { InfoTable, Tag } from '../../../ui'
import { UseFormReturn } from 'react-hook-form'
import { SingleSelect } from '../../../ui/form/SingleSelect'
import JsonField from '../../../ui/form/JsonField'
import TextInput from '../../../ui/form/TextInput'
import KeyValueField from '../../../ui/form/KeyValueField'
import WhatsappBodyBuilder from './WhatsappBodyBuilder'

export const WebhookTable = ({ data }: { data: WebhookTemplateData }) => {
    const { t } = useTranslation()
    return <InfoTable rows={{
        [t('method')]: data.method ?? <Tag variant="warn">{t('missing')}</Tag>,
        [t('endpoint')]: data.endpoint ?? <Tag variant="warn">{t('missing')}</Tag>,
        [t('headers')]: JSON.stringify(data.headers),
        [t('body')]: JSON.stringify(data.body),
        [t('cache_key')]: data.cache_key,
    }} />
}

export const WebhookForm = ({ form }: { form: UseFormReturn<TemplateUpdateParams, any> }) => {
    const { t } = useTranslation()
    return <>
        <SingleSelect.Field
            form={form}
            name="data.method"
            label={t('method')}
            options={['DELETE', 'GET', 'PATCH', 'POST', 'PUT']}
            required />
        <TextInput.Field
            form={form}
            name="data.endpoint"
            label={t('endpoint')}
            placeholder="https://graph.facebook.com/v24.0/{{context.provider.data.business_id}}/messages"
            subtitle={
                <>
                    Supports Handlebars variables. Provider values are available at <code>{'{{context.provider.data...}}'}</code>.
                    Example:&nbsp;
                    <code>{'https://graph.facebook.com/v24.0/{{context.provider.data.business_id}}/messages'}</code>
                </>
            }
            required />
        <WhatsappBodyBuilder form={form} />
        <KeyValueField
            form={form}
            name="data.headers"
            label={t('headers')}
            subtitle={
                <>
                    Supports Handlebars variables. Use <code>lookup</code> for dashed keys.
                    <div className="label-subtitle">
                        <code>Authorization</code>: <code>{'Bearer {{lookup context.provider.data.headers "Authorization"}}'}</code>
                    </div>
                    <div className="label-subtitle">
                        <code>Content-Type</code>: <code>{'{{lookup context.provider.data.headers "Content-Type"}}'}</code>
                    </div>
                </>
            }
        />
        <JsonField
            form={form}
            name="data.body"
            label={t('body')}
            textarea />
        <TextInput.Field
            form={form}
            name="data.cache_key"
            label={t('cache_key')}
            subtitle={t('cache_key_subtitle')} />
    </>
}
