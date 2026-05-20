import {isOwmOnlyLine} from '../../../conversion/mermaid/owmOnlyKeywords';

describe('isOwmOnlyLine', () => {
    it.each([
        'style wardley',
        'style colour',
        'style handwritten',
        'build Foo',
        'x-axis Genesis -> Commodity',
        'y-axis Value -> Invisible',
        'market Customers [0.9, 0.5]',
        'ecosystem Things [0.5, 0.5]',
        'submap Foo [0.5, 0.5]',
        'url foo https://example.com',
        'pioneers [0.1, 0.1, 0.2, 0.2]',
        'explorers [0.1, 0.1, 0.2, 0.2]',
        'villagers [0.5, 0.5, 0.6, 0.6]',
        'accelerator Speed [0.5, 0.5]',
    ])('treats "%s" as an OWM-only line', line => {
        expect(isOwmOnlyLine(line)).toBe(true);
    });

    it.each([
        'component Foo [0.5, 0.5]',
        'anchor User [0.9, 0.9]',
        'Market segmentation -> Last Mile',
        'Pioneer programme -> Funding',
        'evolve Kettle 0.62',
        'style guide -> Funding',
        '',
    ])('treats "%s" as a normal line', line => {
        expect(isOwmOnlyLine(line)).toBe(false);
    });
});
