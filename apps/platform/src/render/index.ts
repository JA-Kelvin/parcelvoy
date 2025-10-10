import Handlebars, { Exception as HandlebarsException } from 'handlebars'
import * as CommonHelpers from './Helpers/Common'
import * as StrHelpers from './Helpers/String'
import * as NumHelpers from './Helpers/Number'
import * as DateHelpers from './Helpers/Date'
import * as UrlHelpers from './Helpers/Url'
import * as ArrayHelpers from './Helpers/Array'
import { User } from '../users/User'
import { preferencesLink, unsubscribeEmailLink } from '../subscriptions/SubscriptionService'
import { clickWrapHtml, openWrapHtml, preheaderWrapHtml, paramsToEncodedLink } from './LinkService'
import Project from '../projects/Project'

export type RenderContext = {
    template_id: number
    campaign_id: number
    subscription_id: number
    reference_type?: string
    reference_id?: string
} & Record<string, unknown>

export interface Variables {
    context: RenderContext
    user: User
    event?: Record<string, any>
    journey?: Record<string, any>
    project: Project
}

export interface TrackingParams {
    user: User
    campaign: number
}

const loadHelper = (helper: Record<string, any>) => {
    const keys = Object.keys(helper)
    const values = Object.values(helper)
    for (const [i] of keys.entries()) {
        Handlebars.registerHelper(keys[i], values[i])
    }
}

loadHelper(CommonHelpers)
loadHelper(StrHelpers)
loadHelper(NumHelpers)
loadHelper(DateHelpers)
loadHelper(UrlHelpers)
loadHelper(ArrayHelpers)

export const compileTemplate = <T = any>(template: string) => {
    return Handlebars.compile<T>(template)
}

export const isHandlerbarsError = (error: any): error is HandlebarsException => {
    return error instanceof HandlebarsException || (error && error.name === 'HandlebarsException')
}

interface WrapParams {
    html: string
    preheader?: string
    variables: Variables
}

export const Wrap = ({ html, preheader, variables: { user, context, project } }: WrapParams) => {
    const trackingParams = {
        userId: user.id,
        campaignId: context.campaign_id,
        referenceId: context.reference_id,
    }

    // Check if link wrapping is enabled first
    if (project.link_wrap_email) {
        html = clickWrapHtml(html, trackingParams)
    }

    // Open wrap & preheader wrap
    html = openWrapHtml(html, trackingParams)
    if (preheader) html = preheaderWrapHtml(html, preheader)
    return html
}

export const Render = (template: string, { user, event, journey, context }: Variables) => {
    return compileTemplate(template)({
        user: user.flatten(),
        event,
        journey,
        context,
        unsubscribeEmailUrl: new Handlebars.SafeString(unsubscribeEmailLink({
            userId: user.id,
            campaignId: context.campaign_id,
            referenceId: context.reference_id,
        })),
        preferencesUrl: new Handlebars.SafeString(preferencesLink(user.id)),
        viewEmailUrl: new Handlebars.SafeString(paramsToEncodedLink({
            path: 'v',
            userId: user.id,
            campaignId: context.campaign_id,
            referenceId: context.reference_id,
        })),
    })
}

// Recursively render an object graph, preserving arrays and non-string primitives.
export const RenderObject = (input: any, variables: Variables): any => {
    // Pass through null/undefined as-is
    if (input == null) return input

    // Preserve arrays – map each element through renderer
    if (Array.isArray(input)) {
        return input.map((v) => {
            if (v != null && typeof v === 'object') return RenderObject(v, variables)
            return typeof v === 'string' ? Render(v, variables) : v
        })
    }

    // Render plain objects key-by-key
    if (typeof input === 'object') {
        return Object.keys(input).reduce((acc, key) => {
            const val = (input as any)[key]
            acc[key] = (val != null && typeof val === 'object')
                ? RenderObject(val, variables)
                : (typeof val === 'string' ? Render(val, variables) : val)
            return acc
        }, {} as Record<string, any>)
    }

    // Primitives: only render strings, keep others intact (number, boolean)
    return typeof input === 'string' ? Render(input, variables) : input
}

export default Render
