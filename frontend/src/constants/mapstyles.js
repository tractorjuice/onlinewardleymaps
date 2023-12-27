import merge from 'lodash.merge';

// use an override model with the default style in case some style options are missing
const mergeIntoDefault = (style) => merge({}, Plain, style);

export const Plain = {
	className: 'plain',
	containerBackground: 'white',
	fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif',
	fontSize: '13px',
	stroke: 'black',
	pipelineArrowStroke: 'black',
	evolutionSeparationStroke: 'black',
	mapGridTextColor: 'black',
	pipelineArrowHeight: '5',
	pipelineArrowWidth: '5',
	strokeWidth: '1',
	strokeDasharray: '2,2',
	anchor: {
		fontSize: '14px',
	},
	attitudes: {
		strokeWidth: '5px',
		fontSize: '14px',
		pioneers: {
			stroke: '#3490dd',
			fill: '#3ccaf8',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
		settlers: {
			stroke: '#396dc0',
			fill: '#599afa',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
		townplanners: {
			stroke: '#4768c8',
			fill: '#936ff9',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
	},
	methods: {
		buy: {
			stroke: '#D6D6D6',
			fill: '#AAA5A9',
		},
		build: {
			stroke: '#000000',
			fill: '#D6D6D6',
		},
		outsource: {
			stroke: '#444444',
			fill: '#444444',
		},
	},
	market: {
		stroke: 'red',
		fill: 'white',
	},
	component: {
		fontSize: '13px',
		fill: 'white',
		stroke: 'black',
		evolved: 'red',
		evolvedFill: 'white',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
		textColor: 'black',
		textOffset: 8,
		evolvedTextColor: 'red',
	},
	submap: {
		fontSize: '13px',
		fill: 'black',
		stroke: 'black',
		evolved: 'red',
		evolvedFill: 'black',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
		textColor: 'black',
		textOffset: 8,
		evolvedTextColor: 'red',
	},
	link: {
		stroke: 'grey',
		strokeWidth: 1,
		evolvedStroke: 'red',
		evolvedStrokeWidth: 1,
		flow: '#99c5ee9e',
		flowStrokeWidth: 10,
		flowText: '#03a9f4',
		contextFontSize: '11px',
	},
	fluidLink: {
		stroke: 'grey',
		strokeDasharray: '2,2',
		strokeWidth: 2,
	},
	annotation: {
		stroke: '#595959',
		strokeWidth: 2,
		fill: 'white',
		text: 'black',
		boxStroke: '#595959',
		boxStrokeWidth: 1,
		boxFill: '#FFFFFF',
		boxTextColour: 'black',
	},
	note: {
		fontWeight: 'bold',
		fontSize: '12px',
		fill: 'black',
	},
};

export const Handwritten = mergeIntoDefault({
	className: 'handwritten',
	fontFamily: '"Gloria Hallelujah", cursive',
	stroke: 'black',
	pipelineArrowStroke: 'black',
	evolutionSeparationStroke: 'black',
	component: {
		fill: 'white',
		stroke: 'black',
		evolved: 'red',
		evolvedFill: 'white',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
	},
	annotation: {
		stroke: '#595959',
		strokeWidth: 2,
		boxStroke: '#595959',
		boxStrokeWidth: 1,
		boxFill: '#FFFFFF',
		boxTextColour: 'black',
	},
});

export const Wardley = mergeIntoDefault({
	className: 'wardley',
	fontFamily: 'Consolas, Lucida Console, monospace',
	stroke: 'black',
	pipelineArrowStroke: 'black',
	evolutionSeparationStroke: '#b8b8b8',
	component: {
		fill: 'white',
		stroke: 'black',
		evolved: 'red',
		evolvedFill: 'white',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
	},
	annotation: {
		stroke: '#595959',
		strokeWidth: 2,
		boxStroke: '#595959',
		boxStrokeWidth: 1,
		boxFill: '#FFFFFF',
		boxTextColour: 'black',
	},
});

export const Dark = mergeIntoDefault({
	className: 'dark',
	containerBackground: '#353347',
	fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif',
	fontSize: '13px',
	stroke: 'white',
	pipelineArrowStroke: 'white',
	evolutionSeparationStroke: 'white',
	mapGridTextColor: 'rgba(255,255,255,.8)',
	pipelineArrowHeight: '5',
	pipelineArrowWidth: '5',
	strokeWidth: '1',
	strokeDasharray: '2,2',
	anchor: {
		fontSize: '14px',
	},
	attitudes: {
		strokeWidth: '5px',
		fontSize: '14px',
		pioneers: {
			stroke: '#3490dd',
			fill: '#3ccaf8',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
		settlers: {
			stroke: '#396dc0',
			fill: '#599afa',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
		townplanners: {
			stroke: '#4768c8',
			fill: '#936ff9',
			fillOpacity: 0.4,
			strokeOpacity: 0.7,
		},
	},
	methods: {
		buy: {
			stroke: '#D6D6D6',
			fill: '#AAA5A9',
		},
		build: {
			stroke: '#000000',
			fill: '#D6D6D6',
		},
		outsource: {
			stroke: '#444444',
			fill: '#444444',
		},
	},
	market: {
		stroke: '#90caf9',
		fill: 'white',
	},
	component: {
		fontSize: '13px',
		fill: 'rgba(255,255,255,.8)',
		stroke: 'white',
		evolved: '#90caf9',
		evolvedFill: 'white',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
		textColor: 'rgba(255,255,255,.8)',
		textOffset: 8,
		evolvedTextColor: '#90caf9',
	},
	submap: {
		fontSize: '13px',
		fill: 'white',
		stroke: 'white',
		evolved: '#90caf9',
		evolvedFill: 'white',
		strokeWidth: '1',
		pipelineStrokeWidth: '2',
		radius: 5,
		textColor: 'white',
		textOffset: 8,
		evolvedTextColor: '#90caf9',
	},
	link: {
		stroke: 'white',
		strokeWidth: 1,
		evolvedStroke: '#90caf9',
		evolvedStrokeWidth: 1,
		flow: '#99c5ee9e',
		flowStrokeWidth: 10,
		flowText: '#03a9f4',
	},
	fluidLink: {
		stroke: 'white',
		strokeDasharray: '2,2',
		strokeWidth: 2,
	},
	annotation: {
		stroke: '#595959',
		strokeWidth: 2,
		fill: 'rgba(255,255,255,.8)',
		text: 'black',
		boxStroke: '#595959',
		boxStrokeWidth: 1,
		boxFill: 'rgba(255,255,255,.8)',
		boxTextColour: 'black',
	},
	note: {
		fontWeight: 'bold',
		fontSize: '12px',
		textColor: 'rgba(255,255,255,.8)',
	},
});

export const Colour = mergeIntoDefault({
	className: 'colour',
	stroke: '#c23667',
	pipelineArrowStroke: '#8cb358',
	evolutionSeparationStroke: '#b8b8b8',
	strokeWidth: '3',
	component: {
		fill: 'white',
		stroke: '#8cb358',
		evolved: '#ea7f5b',
		evolvedFill: 'white',
		strokeWidth: '2',
		pipelineStrokeWidth: '2',
		radius: 7,
		textColor: '#486b1a',
		textOffset: 8,
		evolvedTextColor: '#ea7f5b',
	},
	submap: {
		fill: '#8cb358',
		stroke: '#8cb358',
		evolved: '#ea7f5b',
		evolvedFill: '#8cb358',
		strokeWidth: '2',
		pipelineStrokeWidth: '2',
		radius: 7,
		textColor: '#486b1a',
		textOffset: 8,
		evolvedTextColor: '#ea7f5b',
	},
	link: {
		stroke: '#5c5c5c',
		evolvedStroke: '#ea7f5b',
		flow: '#99c5ee9e',
	},
	annotation: {
		stroke: '#015fa5',
		strokeWidth: 2,
		fill: '#99c5ee',
		boxStroke: '#015fa5',
		boxStrokeWidth: 2,
		boxFill: '#99c5ee',
		boxTextColour: 'black',
	},
});
