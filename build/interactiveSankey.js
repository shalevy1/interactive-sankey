(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('webcharts')) :
	typeof define === 'function' && define.amd ? define(['webcharts'], factory) :
	(global.interactiveSankey = factory(global.webCharts));
}(this, (function (webcharts) { 'use strict';

if (typeof Object.assign != 'function') {
    (function () {
        Object.assign = function (target) {
            'use strict';

            if (target === undefined || target === null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }

            var output = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var source = arguments[index];
                if (source !== undefined && source !== null) {
                    for (var nextKey in source) {
                        if (source.hasOwnProperty(nextKey)) {
                            output[nextKey] = source[nextKey];
                        }
                    }
                }
            }
            return output;
        };
    })();
}

var defaultSettings = //Customizable template settings
{
    id_col: 'USUBJID',
    node_col: null,
    link_col: null,

    //Standard template settings
    x: { type: 'ordinal' },
    y: { type: 'linear' },
    marks: [{
        type: 'bar',
        arrange: 'stacked',
        summarizeY: 'count',
        tooltip: '$y at $x'
    }],
    legend: {}
};

function syncSettings(settings) {
    settings.x.column = settings.node_col;
    settings.x.label = settings.node_col;
    settings.y.column = settings.id_col;
    settings.y.label = '# of ' + settings.id_col + 's';
    settings.marks[0].per = [settings.node_col];
    settings.marks[0].split = settings.link_col;
    settings.color_by = settings.link_col;

    return settings;
}

function onDataTransform() {
    var chart = this;
}

function onDestroy() {
    var chart = this;
}

function onDraw() {
    var chart = this;
}

function onInit() {
    var _this = this;

    var chart = this;

    //Sort raw data by node so that links are drawn between adjacent nodes.
    this.raw_data = this.raw_data.sort(function (a, b) {
        return a[_this.config.node_col] < b[_this.config.node_col] ? -1 : a[_this.config.node_col] > b[_this.config.node_col] ? 1 : 0;
    });
}

function onLayout() {
    var chart = this;
}

function onPreprocess() {
    var chart = this;
}

function drawLinks(chartObject, bars1, bars2, linkClass) {
    //Merge adjacent bar groups by [ config.y.column ].
    var linkData = [];
    bars1.each(function (bar1, i1) {
        bars2.each(function (bar2, i2) {
            bar1.values.raw.forEach(function (id1) {
                bar2.values.raw.forEach(function (id2) {
                    if (id1[chartObject.config.y.column] === id2[chartObject.config.y.column]) linkData.push({
                        id: id1[chartObject.config.y.column],
                        split1: id1[chartObject.config.color_by],
                        x1: id1[chartObject.config.x.column],
                        split2: id2[chartObject.config.color_by],
                        x2: id2[chartObject.config.x.column]
                    });
                });
            });
        });
    });

    //Nest merged bar groups by their respective [ config.marks.color_by ] values.
    var nestedLinkData = d3.nest().key(function (d) {
        return d.split1;
    }).key(function (d) {
        return d.split2;
    }).rollup(function (d) {
        return { n: d.length, IDs: d.map(function (di) {
                return di.id;
            }) };
    }).entries(linkData);
    nestedLinkData.sort(function (a, b) {
        return a.key > b.key ? 1 : -1;
    });

    //Flatten nested data array to one item per left bar [ config.marks.color_by ]
    //value per right bar [ config.marks.color_by ] value.
    var collapsedLinkData = [];
    var offsetList = [];
    nestedLinkData.forEach(function (d, i) {
        var cat1 = bars1.data()[0].values.x;
        var bar1 = bars1.filter(function (dii) {
            return dii.key === d.key;
        }).data()[0].values;
        var offset1 = 0;
        d.values.sort(function (a, b) {
            return a.key < b.key ? -1 : b.key < a.key ? 1 : 0;
        });

        d.values.forEach(function (di) {
            var cat2 = bars2.data()[0].values.x;
            var bar2 = bars2.filter(function (dii) {
                return dii.key === di.key;
            }).data()[0].values;
            offsetList.push({ key: di.key, offset: 0 });
            var offset2 = offsetList.filter(function (dii) {
                return dii.key === di.key;
            })[0].offset;

            collapsedLinkData.push({
                split1: d.key,
                split2: di.key,

                x1: chartObject.x(cat1),
                x2: chartObject.x(cat2),

                y1: bar1.y,
                y2: bar2.y,

                start1: bar1.start,
                start2: bar2.start,

                stop1: bar1.start - bar1.y,
                stop2: bar2.start - bar2.y,

                y01: bar1.start - bar1.y + offset1,
                y11: bar1.start - bar1.y + di.values.n + offset1,

                y02: bar2.start - bar2.y + offset2,
                y12: bar2.start - bar2.y + di.values.n + offset2,

                n: di.values.n,
                height: chartObject.y(di.values.n),

                IDs: di.values.IDs
            });

            offset1 += collapsedLinkData[collapsedLinkData.length - 1].n;
            offsetList.filter(function (dii) {
                return dii.key === di.key;
            })[0].offset += di.values.n;
        });
    });

    //Draw links.
    var pathDrawer = d3.svg.area().x(function (d) {
        return d.x;
    }).y0(function (d) {
        return d.y0;
    }).y1(function (d) {
        return d.y1;
    });
    collapsedLinkData.forEach(function (d, i) {
        var path = [{
            split1: d.split1,
            split2: d.split2,
            n: d.n,
            IDs: d.IDs,

            x: d.x1 + chartObject.x.rangeBand(),
            y0: chartObject.y(d.y01),
            y1: chartObject.y(d.y11)
        }, {
            x: d.x2,
            y0: chartObject.y(d.y02),
            y1: chartObject.y(d.y12)
        }];
        chartObject.svg.append('path').datum(path).attr({
            d: pathDrawer,
            class: 'link ' + linkClass
        }).style({
            fill: function fill() {
                return chartObject.colorScale(d.split1);
            },
            'fill-opacity': 0.5,
            stroke: function stroke() {
                return chartObject.colorScale(d.split1);
            },
            'stroke-opacity': 0.5
        });
    });

    //Add event listeners and tooltips to links.
    var links = d3.selectAll('path.link');
    links.on('mouseover', function () {
        d3.select(this).style({
            'fill-opacity': 1,
            'stroke-opacity': 1
        });
    }).on('mouseout', function () {
        d3.select(this).style({
            'fill-opacity': 0.5,
            'stroke-opacity': 0.5
        });
    }).append('title').text(function (d) {
        var n = d[0].n;
        var split1 = d[0].split1;
        var split2 = d[0].split2;
        var IDs = d[0].IDs;
        return n + ' ' + chartObject.config.y.column + (n > 1 ? 's ' : ' ') + (split1 === split2 ? 'remained at ' + split1 : 'progressed from ' + split1 + ' to ' + split2) + ':\n - ' + IDs.slice(0, 3).join('\n - ') + (n > 3 ? '\n - and ' + (n - 3) + ' more' : '');
    });
}

function onResize() {
    var chart = this;

    //Reset displays.
    this.wrap.selectAll('path.link').remove();
    this.wrap.selectAll('.barAnnotation').remove();

    //Update legend to represent categories represented in chart.
    this.makeLegend();
    var currentLinks = d3.set(this.filtered_data.map(function (d) {
        return d[chart.config.link_col];
    })).values();
    this.wrap.selectAll('.legend-item').filter(function () {
        return currentLinks.indexOf(d3.select(this).select('.legend-label')[0][0].textContent) === -1;
    }).remove();

    /**-------------------------------------------------------------------------------------------\
      Default links
    \-------------------------------------------------------------------------------------------**/

    //Capture stacked bar groups.
    var barGroups = this.svg.selectAll('.bar-group');
    var nBarGroups = barGroups[0].length - 1;
    barGroups.each(function (barGroup, i) {
        //Annotate bars and modify tooltips.
        var yPosition = barGroup.total;
        d3.select(this).selectAll('rect.wc-data-mark').each(function (d) {
            var bar = d3.select(this);
            bar.classed(d.key.replace(/[^a-z0-9]/gi, ''), true);
            var IDs = d.values.raw.map(function (d) {
                return d[chart.config.id_col];
            });
            var n = d.values.raw.length;
            var N = chart.raw_data.filter(function (di) {
                return di[chart.config.node_col] === d.values.x;
            }).length;
            var pct = n / N;
            d3.select(bar.node().parentNode).append('text').datum([{ node: d.values.x, link: d.key, text: n + ' (' + d3.format('%')(pct) + ')' }]).attr({
                class: 'barAnnotation',
                x: function x(di) {
                    return chart.x(d.values.x);
                },
                y: function y(di) {
                    return chart.y(yPosition);
                },
                dx: '.25em',
                dy: '.9em'
            }).text(n + ' (' + d3.format('%')(pct) + ')');
            bar.select('title').text(n + ' ' + chart.config.id_col + 's at ' + d.key + ' (' + d3.format('%')(pct) + '):' + '\n - ' + IDs.slice(0, 3).join('\n - ') + (n > 3 ? '\n - and ' + (n - 3) + ' more' : ''));
            yPosition -= n;
        });

        //Draw links from any bar group except the last bar group.
        if (i < nBarGroups) {
            var barGroup1 = d3.select(this);
            var barGroup2 = d3.select(barGroups[0][i + 1]);
            drawLinks(chart, barGroup1.selectAll('.bar'), barGroup2.selectAll('.bar'), 'defaultLink');
        }
    });

    /**-------------------------------------------------------------------------------------------\
      Selected links
    \-------------------------------------------------------------------------------------------**/

    //Flatten [ this.current_data ] to one item per node per link.
    var barData = [];
    this.current_data.forEach(function (d) {
        d.values.forEach(function (di) {
            barData.push({
                node: d.key,
                link: di.key,
                start: di.values.start
            });
        });
    });

    //Add click event listener to bars.
    var bars = this.wrap.selectAll('rect.wc-data-mark');
    bars.style('cursor', 'pointer').on('click', function (d) {
        //Reduce bar opacity.
        var thisBar = this;
        bars.style('fill-opacity', 0.25);
        chart.wrap.selectAll('.defaultLink').style('display', 'none');
        chart.wrap.selectAll('.barAnnotation').style('display', 'none');
        chart.wrap.selectAll('.selectedIDs').remove();
        chart.wrap.selectAll('.selectedLink').remove();
        //Capture [ settings.id_col ] values represented by selected bar.
        var selectedIDs = d.values.raw.map(function (d) {
            return d[chart.config.id_col];
        });
        //Filter raw data on selected [ settings.id_col ] values and nest by node and link.
        var selectedData = d3.nest().key(function (d) {
            return d[chart.config.node_col];
        }).key(function (d) {
            return d[chart.config.link_col];
        }).rollup(function (d) {
            return d.length;
        }).entries(chart.raw_data.filter(function (d) {
            return selectedIDs.indexOf(d[chart.config.id_col]) > -1;
        }));
        //Flatten nested data to one item per node per link.
        var selectedBarData = [];
        selectedData.forEach(function (d) {
            d.values.forEach(function (di) {
                return selectedBarData.push({
                    key: di.key,
                    values: {
                        raw: chart.raw_data.filter(function (dii) {
                            return selectedIDs.indexOf(dii[chart.config.id_col]) > -1 && dii[chart.config.node_col].toString() === d.key.toString() && dii[chart.config.link_col].toString() === di.key.toString();
                        }),
                        x: d.key,
                        y: di.values,
                        start: barData.filter(function (dii) {
                            return dii.node === d.key && dii.link === di.key;
                        })[0].start
                    }
                });
            });
        });
        //Draw bars.
        var selectedIDbars = chart.svg.selectAll('rect.selectedIDs').data(selectedBarData).enter().append('rect').attr({
            class: 'selectedIDs',
            x: function x(d) {
                return chart.x(d.values.x);
            },
            y: function y(d) {
                return chart.y(d.values.start);
            },
            width: d3.select(this).attr('width'),
            height: function height(d) {
                return chart.y(d.values.start - d.values.y) - chart.y(d.values.start);
            }
        }).style({
            fill: function fill(d) {
                return chart.colorScale(d.key);
            },
            stroke: function stroke(d) {
                return chart.colorScale(d.key);
            }
        });
        selectedIDbars.each(function () {
            d3.select(this).append('title').text(function (di) {
                return di.values.y + ' ' + chart.config.id_col + 's at ' + di.values.x + ' (' + d3.format('%')(di.values.y / selectedIDs.length) + '):' + '\n - ' + di.values.raw.map(function (dii) {
                    return dii[chart.config.id_col];
                }).slice(0, 3).join('\n - ') + (di.values.y > 3 ? '\n - and ' + (di.values.y - 3) + ' more' : '');
            });
        });
        //Annotate bars.
        chart.svg.selectAll('text.selectedIDs').data(selectedBarData).enter().append('text').attr({
            class: 'selectedIDs',
            x: function x(d) {
                return chart.x(d.values.x);
            },
            y: function y(d) {
                return chart.y(d.values.start);
            },
            dx: '.25em',
            dy: '.9em'
        }).text(function (d) {
            return d.values.y + ' (' + d3.format('%')(d.values.y / selectedIDs.length) + ')';
        });
        //Draw links.
        var nodes = selectedData.map(function (d) {
            return d.key;
        });
        for (var i = 0; i < nodes.length; i++) {
            if (i < nodes.length - 1) {
                drawLinks(chart, selectedIDbars.filter(function (d) {
                    return d.values.x === nodes[i];
                }), selectedIDbars.filter(function (d) {
                    return d.values.x === nodes[i + 1];
                }), 'selectedLink');
            }
        }
        //Add click event listener to selected bars.
        selectedIDbars.style('cursor', 'pointer').on('click', function () {
            bars.style('fill-opacity', 1);
            selectedIDbars.remove();
            chart.wrap.selectAll('text.selectedIDs').remove();
            chart.wrap.selectAll('.selectedLink').remove();
            chart.wrap.selectAll('.defaultLink').style('display', '');
            chart.wrap.selectAll('.barAnnotation').style('display', '');
        });
    });
}

var callbacks = {
    onInit: onInit,
    onLayout: onLayout,
    onPreprocess: onPreprocess,
    onDataTransform: onDataTransform,
    onDraw: onDraw,
    onResize: onResize,
    onDestroy: onDestroy
};

function interactiveSankey(element, settings) {
    //Merge user's settings with default settings..
    var mergedSettings = Object.assign({}, defaultSettings, settings);

    //Sync settings with data mappings.
    var syncedSettings = syncSettings(mergedSettings);

    //Create chart.
    var chart = webcharts.createChart(element, syncedSettings);
    for (var callback in callbacks) {
        chart.on(callback.toLowerCase().substring(2), callbacks[callback]);
    }return chart;
}

return interactiveSankey;

})));
