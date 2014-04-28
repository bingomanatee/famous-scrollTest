var wd = require('wd');

var browser = wd.promiseChainRemote();
var fs = require('fs');
var util = require('util');
var _ = require('lodash');
var Canvas = require('canvas');
var color_list = require('./color_list.json');
var ss = require('simple-statistics');

function analyze_colors(pointData, cb) {
    var out = [];
    _.each(pointData, function (data) {
        if (data.color[0] == data.color[1] == data.color[2] == 0) {
            return;
        }
        var index = -1;
        _.each(color_list.colors, function (color, i) {
            if (index != -1) {
                return;
            }
            color = color.slice(0, 3);
            var data_color = _.toArray(data.color).slice(0, 3);
            if (_.isEqual(color, data_color)) {
                index = i
            }
        });

        if (index != -1) {
            out.push({
                index: index,
                color: data.color,
                center: data.center
            });
        }
    });

    var xy = _.reduce(out, function(o, value){
         o.push([value.index, value.center.y]);
        return o;
    }, []);

    var linreg = ss.linear_regression().data(xy);

    fs.writeFile('data_hits.json', JSON.stringify({data: out, slope: linreg.m(), intercept: linreg.b()}), cb);
}

function drawContours(base, output, data, callback) {

    fs.readFile(__dirname + '/' + base, function (err, buffer) {
        var snapshotImage = new Canvas.Image();
        snapshotImage.src = buffer;

        console.log('stage size: %s x %s ', snapshotImage.width, snapshotImage.height);
        var stageCanvas = new Canvas(snapshotImage.width, snapshotImage.height);
        var ctx = stageCanvas.getContext('2d');
        ctx.drawImage(snapshotImage, 0, 0, snapshotImage.width, snapshotImage.height);

        var pointData = _.map(data, function (points) {
            var center = _.reduce(points, function (out, pt) {
                out.x += pt.x / points.length;
                out.y += pt.y / points.length;
                return out;
            }, {x: 0, y: 0});

            var c = ctx.getImageData(center.x, center.y, 1, 1).data;
            return {points: points, center: center, color: c};

        });

        analyze_colors(pointData, function () {

            function _color(a) {
                return 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
            }

            _.each(pointData, function (data) {
                ctx.beginPath();

                // outer contour stroke

                var lastPoint = _.last(data.points);
                ctx.lineWidth = 4;

                ctx.strokeStyle = 'black';
                ctx.moveTo(lastPoint.x, lastPoint.y);
                _.each(data.points, function (point, i) {
                    console.log('point %s: (%s, %s)', i, point.x, point.y);
                    ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();

                ctx.stroke();

                // inner contour stroke
                var lastPoint = _.last(data.points);
                ctx.lineWidth = 1;

                ctx.strokeStyle = _color(data.color);

                ctx.moveTo(lastPoint.x, lastPoint.y);
                _.each(data.points, function (point, i) {
                    console.log('point %s: (%s, %s)', i, point.x, point.y);
                    ctx.lineTo(point.x, point.y);
                });
                ctx.closePath();

                ctx.stroke();

                //swatch outline
                ctx.fillStyle = 'white';

                ctx.beginPath();
                ctx.arc(data.center.x, data.center.y, 20, 0, Math.PI * 2);
                ctx.closePath();

                ctx.fill();

                // swatch shadow
                ctx.fillStyle = 'black';

                ctx.beginPath();
                ctx.arc(data.center.x, data.center.y, 16, 0, Math.PI * 2);
                ctx.closePath();

                ctx.fill();

                // swatch
                ctx.fillStyle = _color(data.color);

                ctx.beginPath();
                ctx.arc(data.center.x - 2, data.center.y - 2, 16, 0, Math.PI * 2);
                ctx.closePath();

                ctx.fill();
            });

            var outStream = stageCanvas.pngStream();
            var out = fs.createWriteStream(__dirname + '/' + output);
            outStream.on('data', function (c) {
                out.write(c);
            });

            outStream.on('end', callback);
        });

    });
}

browser.init({browserName: 'chrome'})
    .get('http://localhost:1337')
    .setWindowSize(800, 500)
    .then(function () {
        setTimeout(function () {
            browser.elementByCss('.run-button')
                .click()
                .then(function () {
                    console.log('running');
                    setTimeout(function () {
                        browser.chain()
                            .takeScreenshot()
                            .then(function (data) {
                                var base64Data = data.replace(/^data:image\/png;base64,/, "");

                                fs.writeFile("out.png", base64Data, 'base64', function (err) {
                                    if (err) {
                                        return console.log(err);
                                    }

                                    fs.readFile("out.png", function (err, buffer) {
                                        var snapshotImage = new Canvas.Image();
                                        snapshotImage.src = buffer;
                                        var stageCanvas = new Canvas(snapshotImage.width, snapshotImage.height);
                                        var ctx = stageCanvas.getContext('2d');
                                        ctx.drawImage(snapshotImage, 0, 0, snapshotImage.width, snapshotImage.height);

                                        var outStream = stageCanvas.pngStream();
                                        var out = fs.createWriteStream(__dirname + '/outCanvas.png');
                                        outStream.on('data', function (c) {
                                            out.write(c);

                                        });

                                        outStream.on('end', function () {
                                            browser.chain()
                                                .fin(function () {
                                                    return browser.quit();
                                                })
                                                .done(function () {
                                                    var cv = require('opencv');
                                                    cv.readImage('out.png', function (err, im) {
                                                        im_canny = im.copy();
                                                        im_canny.canny(0, 100);
                                                        im_canny.dilate(2); // iters
                                                        var contourData = [];
                                                        var contours = im_canny.findContours();
                                                        for (var i = 0; i < contours.size(); ++i) {
                                                            var arcLength = contours.arcLength(i, true);
                                                            contours.approxPolyDP(i, 0.01 * arcLength, true);
                                                            console.log('contour area: ', contours.area(i));
                                                            console.log('contour corners: ', contours.cornerCount(i));
                                                            if ((contours.area(i) < 1000)) {
                                                                continue;
                                                            }

                                                            // extract perimiter of region
                                                            var points = _.map(_.range(0, contours.cornerCount(i)), function (p) {
                                                                return contours.point(i, p);
                                                            });

                                                            contourData.push(points);
                                                        }

                                                        console.log('drawing contours');

                                                        drawContours('out.png', 'out_contour.png', contourData, function () {
                                                            console.log('done drawing contours');
                                                        });
                                                    });
                                                });
                                        });
                                    });
                                });

                            }).catch(function (err) {
                                console.log('error: %s', err);
                            });
                    }, 2000);
                }).catch(function (err2) {
                    console.log('e2: %s', err2);
                });

        }, 2000);
    });