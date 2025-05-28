import Project from '../../projects/Project'
import { RuleTree } from '../../rules/Rule'
import { uuid } from '../../utilities'

afterEach(() => {
    jest.clearAllMocks()
})

describe('ListService', () => {

    const makeRule = async () => {
        const project = await Project.insertAndFetch({
            name: 'Dynamic List Project',
        })

        const ruleUuid = uuid()
        const eventUuid = uuid()

        const rule: RuleTree = {
            uuid: ruleUuid,
            group: 'parent',
            type: 'wrapper',
            operator: 'or',
            path: '',
            children: [
                {
                    uuid: uuid(),
                    parent_uuid: ruleUuid,
                    root_uuid: ruleUuid,
                    group: 'user',
                    type: 'string',
                    operator: '=',
                    path: '$.first_name',
                    value: 'chris',
                },
                {
                    uuid: eventUuid,
                    parent_uuid: ruleUuid,
                    root_uuid: ruleUuid,
                    group: 'event',
                    type: 'wrapper',
                    operator: 'and',
                    path: '$.name',
                    value: 'purchased',
                    children: [
                        {
                            uuid: uuid(),
                            parent_uuid: eventUuid,
                            root_uuid: ruleUuid,
                            group: 'event',
                            type: 'string',
                            operator: '=',
                            path: '$.food',
                            value: 'cake',
                        },
                    ],
                },
            ],
        }

        return { rule, project }
    }

    describe('list generation', () => {
    })
})
