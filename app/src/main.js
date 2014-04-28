/*globals define*/
define(function (require, exports, module) {
    'use strict';
    // import dependencies
    var Engine = require('famous/core/Engine');
    var Surface = require('famous/core/Surface');
    var StateModifier = require('famous/modifiers/StateModifier');
    var ScrollContainer = require('famous/views/ScrollContainer');
    var ScrollView = require('famous/views/ScrollView');
    var Transform = require('famous/core/Transform');
    var color_list = require('color_list');

    var _ = require('lodash');
    var ContainerSurface = require('famous/surfaces/ContainerSurface');

    // create the main context
    var mainContext = Engine.createContext();

    // your app here

    var scroller = new ScrollContainer({
        scrollview: _.defaults({size: [300, 400]}, ScrollView.DEFAULT_OPTIONS),
        classes: ['myScroller']
    });

    var __color = _.template('rgb(<%= red %>,<%= green %>,<%= blue %>)');

    function _color(value) {
       var length = color_list.colors.length;
        value %= length;
        var color = color_list.colors[value];
        return __color({red: color[0], green: color[1], blue: color[2]});
    }

    scroller.sequenceFrom(_.map(_.range(0, 100), function (value) {
        var surface = new Surface({
            size: [300, 50],
            properties: {
                backgroundColor: _color(value)
            }
        });

        surface.pipe(scroller);
        return surface;
    }));

    var scrollMod = new StateModifier({transform: Transform.translate(10, 10), size: [300, 400]});

    var buttonMod = new StateModifier({   transform: Transform.translate(300, 0, 0)   });

    mainContext.add(scrollMod).add(scroller);

    var runButton = new Surface({
        size: [300, 50],
        content: 'Click to scroll',
        properties: {
            backgroundColor: 'red',
            fontSize: '20pt',
            textAlign: 'center',
            paddingTop: '5px',
            color: 'white'
        },
        classes: ['run-button']
    });

    var time;
    scroller.scrollview._eventInput.on('start', function (data) {
        time = new Date().getTime();
        console.log('start: ', data);
    });
    scroller.scrollview._eventInput.on('update', function (data) {
        var t2 = new Date().getTime();
        console.log('update: ', data, t2 - time);
    });
    scroller.scrollview._eventInput.on('end', function (data) {
        console.log('end: ', data);
    });

    runButton.on('click', function () {
        scroller.scrollview._eventInput.emit('start', {slip: true});
        buttonMod.setOpacity(0);
        setTimeout(function () {
            scroller.scrollview._eventInput.emit('update', {delta: -120, position: -120, velocity: -0.1, slip: true});
            setTimeout(function () {
                // scroller._eventInput.emit('end', {delta: -120, position: 0, velocity: 0, slip: true});
            }, 500)
        }, 10);

    });

    mainContext.add(buttonMod).add(runButton);

});
