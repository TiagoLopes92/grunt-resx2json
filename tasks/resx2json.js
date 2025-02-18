var xml2js = require('xml2js');
var _ = require('underscore');

module.exports = function(grunt) {

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('resx2json', 'Convert resx to a json file.', function() {
    var task = this;
    var allLocales = {};

    var localeExtractor = function(src, options){
        var match = options.localePattern.exec(src);
        return match ? match[0] : options.defaultLocale;
    };

    var options = task.options({
      defaultLocale: 'en-US',
      concat: false,
      dest: 'dist/',
      prefix: 'output',
      ext: '.json',
      namespaceSeparator: '_',
      localePattern: /[a-z]{2}-[A-Z]{2}/,
      localeExtractor: localeExtractor,
      afterParseLocale: undefined
    });

    var rename = function(src, options){
      if (!options) options = src;
      var filename;
      if (options.concat){
        filename = options.prefix+options.ext;
      } else {
        filename = (options.prefix ? options.prefix + '.' : '') + options.localeExtractor(src, options) + options.ext;
      }
      return filename;
    };

    var createFileDescriptor = function(filename) {
      var locale = options.localeExtractor(filename, options);
      var namespace = filename.replace('.resx', '').replace(options.namespaceFrom, '').replace('.' + locale, '');

      namespace = namespace.split('/');

      return {src: filename, locale: locale, dest: rename(filename, options), namespace: namespace};
    };

    function processNestedNameSpaces(tree){
      var treeKeys = Object.keys(tree);

      var foundNestedNamespaces = treeKeys.filter(function(key){
        return key.indexOf(options.namespaceSeparator) != -1;
      });

      for (var i = 0; i < foundNestedNamespaces.length; i++) {
        var namespace = foundNestedNamespaces[i];
        var namespaceLevels = namespace.split(options.namespaceSeparator);
        var length = namespaceLevels.length;
        var currentNode = tree;
        for (var j = 0; j < length; j++) {
          var property = namespaceLevels[j];

          if(j != (length -1)){
            if(!currentNode[property]) currentNode[property] = {};
            currentNode = currentNode[property];
          } else {
              currentNode[property] = tree[namespace];
              delete tree[namespace];
          }
        }

      }
      return tree;
    };

    grunt.log.writeln('Found ' + this.filesSrc.length + ' files to process.');

    var filesByLocale =
      _.chain(this.filesSrc)
        .map(function(thisFile){
          return createFileDescriptor(thisFile);
        })
        .groupBy(function(destObj){ return destObj.locale; })
        .value();

    _.each(filesByLocale, function(destObjs, locale){
      var allMerged =
        _(destObjs).reduce(function(merged,destObj){
          var contents = parseFile(grunt.file.read(destObj.src));
          var positionOnTree = merged;

          for(var i=0; i< destObj.namespace.length; i++) {
            if(!positionOnTree[destObj.namespace[i]]) {
              positionOnTree[destObj.namespace[i]] = {};
            }
            positionOnTree = positionOnTree[destObj.namespace[i]];
          }

          processNestedNameSpaces(contents);
          _.extend(positionOnTree, contents);

          return merged;
        },{});

      if(options.afterParseLocale && typeof(options.afterParseLocale) === 'function'){
        allMerged = options.afterParseLocale(allMerged);
      }

      if (options.concat){
        var cur = {};
        cur[locale] = allMerged;
        _.extend(allLocales, cur);
      } else {
        grunt.file.write(options.dest+destObjs[0].dest,JSON.stringify(allMerged, null, '\t'));
      }
    });

    if (options.concat){
      grunt.file.write(options.dest + rename(options),JSON.stringify(allLocales, null, '\t'));
    }

    // Fail task if errors were logged.
    if (this.errorCount) { return false; }

    // Otherwise, print a success message.
    grunt.log.writeln('Finished JSON generation.');
  });


  var parseFile = function(fileContent,lang) {
    var parser = new xml2js.Parser(),
        resourceArr = {};

    parser.parseString(fileContent, function (err, result) {
        if (err){
          grunt.error.writeln('error:'+err);
          return;
        }
        if (result && result.root){
          resourceArr = _.reduce(result.root.data, function(memo,curEle){memo[curEle['$'].name]=(curEle.value||[])[0]; return memo;}, {});
        }
    });
    return resourceArr;
  };
};
