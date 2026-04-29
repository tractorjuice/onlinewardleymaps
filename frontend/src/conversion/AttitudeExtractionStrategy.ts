import {setAttitude, setCoords, setHeightWidth, setManyCoords} from '../constants/extractionFunctions';
import {IParseStrategy} from '../types/base';
import BaseStrategyRunner from './BaseStrategyRunner';

export default class AttitudeExtractionStrategy implements IParseStrategy {
    data: string;
    containerName: string;
    baseStrategies: BaseStrategyRunner[];
    constructor(data: string) {
        this.data = data;
        this.containerName = 'attitudes';
        // 'explorers' and 'villagers' are aliases for 'pioneers' and 'settlers' respectively
        // (Wardley's Pioneers/Settlers/Town Planners terminology, optionally renamed to
        // Explorers/Villagers/Town Planners). Both keyword sets parse and render identically.
        this.baseStrategies = ['pioneers', 'settlers', 'townplanners', 'explorers', 'villagers']
            .map(
                e =>
                    new BaseStrategyRunner(
                        data,
                        {
                            keyword: e,
                            containerName: 'attitudes',
                            defaultAttributes: {increaseLabelSpacing: 0},
                        },
                        [setAttitude, setCoords, setManyCoords, setHeightWidth],
                    ),
            )
            .flat();
    }

    apply() {
        const output = this.baseStrategies.map(bs => bs.apply()).flat();
        return {
            [this.containerName]: output.map(o => o.attitudes).flat(),
            errors: [],
        };
    }
}
