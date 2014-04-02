/*jshint node: true*/
'use strict';

var cheerio = require('cheerio'),
  url = require('url'),
  util = require('util'),
  http = require('http'),
  https = require('https');

util._ = require('underscore');

module.exports.parse = function (data, callback) {
  var tmp;


  if (typeof(data) === 'string') {
    try {
      tmp = url.parse(data);
    } catch (err) {
      throw new Error('no data or url specified');
    }
  } else {
    tmp = {}
  }

  if (tmp.protocol && tmp.host && tmp.hostname) {
    // data is url
    if (!callback) {
      throw new Error('no callback specified');
    }

    var request = (tmp.protocol === 'https:' ? https : http).get(tmp, function (response) {
      var data;
      response.setEncoding('utf8');
      response.on('data', function (chunk) {
          data += chunk;
        })
        .on('end', function () {
          callback(parseString(data));
        });
    });
    request.setTimeout(5000);

    return;
  } else {
    // data is html
    var result = parseString(data);

    if (callback) {
      callback(result);
    }

    return result;
  }

  function parseString(data) {

    var result = [];
    var $;

    if(typeof(data) === 'string') {
      $ = cheerio.load(data, {
        ignoreWhitespace: true,
        xmlMode: false,
        lowerCaseTags: true
      });
    } else {
      $ = data;
    }

    function parseLevel(root) {
      var scopeSelector = '[itemscope][itemtype]:not([itemscope] [itemscope])',
        propSelector = '[itemprop]:not([itemscope] [itemprop]):not([itemscope])',
        result = [];

      $(scopeSelector, root.html()).each(function () {
        var itemType = this.attr('itemtype'),
          props = {};

        $(propSelector, $(this).html()).each(function () {
          var propName = this.attr('itemprop'),
            value;
          switch (this[0].name) {
          case 'audio':
          case 'embed':
          case 'iframe':
          case 'img':
          case 'source':
          case 'track':
          case 'video':
            value = this.attr('src');
            break;
          case 'a':
          case 'area':
          case 'link':
            value = this.attr('href');
            break;
          case 'object':
            value = this.attr('data');
            break;
          default:
            value = this.html().trim();
            break;
          }
          if (value) {
            if (util._.has(props, propName)) {
              var currentValue = props[propName];
              if (util.isArray(currentValue)) {
                props[propName].push(value);
              } else {
                props[propName] = [currentValue, value];
              }
            } else {
              props[propName] = value;
            }
          }
        });

        var tmp = {
          "itemtype": itemType,
          "itemprop": props
        };
        var children = parseLevel($(this));
        if (children.length > 0) {
          util._.extend(tmp, {
            "children": children
          });
        }

        result.push(tmp);
      });

      return result;
    }

    return parseLevel($);
  }
};
