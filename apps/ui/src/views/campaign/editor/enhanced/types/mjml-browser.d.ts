// Type declarations for mjml-browser
declare module 'mjml-browser' {
    interface MjmlResult {
        html: string
        errors: Array<{
            line: number
            message: string
            tagName: string
        }>
    }

    function mjml(mjmlString: string, options?: any): MjmlResult
    export = mjml
}
