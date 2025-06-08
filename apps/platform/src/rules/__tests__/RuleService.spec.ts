import { createTestProject } from '../../projects/__tests__/ProjectTestHelpers'
import { User } from '../../users/User'
import { uuid } from '../../utilities'
import Rule from '../Rule'
import { RuleWithEvaluationResult, checkRules } from '../RuleService'

describe('RuleService', () => {
    const makeWrapper = async (project_id: number) => {
        return await Rule.insertAndFetch({
            project_id,
            uuid: uuid(),
            path: '',
            type: 'wrapper',
            group: 'parent',
            operator: 'any',
        })
    }

    describe('checkRules', () => {
        test('a non passing event rule should fail', async () => {
            const { id: project_id } = await createTestProject()
            const user = await User.insertAndFetch({
                project_id,
                external_id: uuid(),
                data: { numberOfThings: 10 },
            })
            const root = await makeWrapper(project_id)
            const rules: RuleWithEvaluationResult[] = [{
                uuid: uuid(),
                group: 'event',
                type: 'wrapper',
                path: '$.name',
                operator: '=',
                value: 'Entered',
                result: false,
            }]

            const result = checkRules(user, root, rules)
            expect(result).toBe(false)
        })

        test('a non passing user rule should fail', async () => {
            const { id: project_id } = await createTestProject()
            const user = await User.insertAndFetch({
                project_id,
                external_id: uuid(),
                data: { numberOfThings: 2 },
            })
            const root = await makeWrapper(project_id)
            const rules: RuleWithEvaluationResult[] = [{
                uuid: uuid(),
                group: 'user',
                type: 'number',
                path: '$.numberOfThings',
                operator: '>',
                value: 5,
            }, {
                uuid: uuid(),
                group: 'event',
                type: 'wrapper',
                path: '$.name',
                operator: '=',
                value: 'Entered',
                result: true,
            }]

            const result = await checkRules(user, root, rules)
            expect(result).toBe(false)
        })
    })
})
