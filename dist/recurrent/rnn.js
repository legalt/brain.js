'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _matrix = require('./matrix');

var _matrix2 = _interopRequireDefault(_matrix);

var _randomMatrix = require('./matrix/random-matrix');

var _randomMatrix2 = _interopRequireDefault(_randomMatrix);

var _equation = require('./matrix/equation');

var _equation2 = _interopRequireDefault(_equation);

var _sampleI2 = require('./matrix/sample-i');

var _sampleI3 = _interopRequireDefault(_sampleI2);

var _maxI = require('./matrix/max-i');

var _maxI2 = _interopRequireDefault(_maxI);

var _softmax = require('./matrix/softmax');

var _softmax2 = _interopRequireDefault(_softmax);

var _copy = require('./matrix/copy');

var _copy2 = _interopRequireDefault(_copy);

var _random = require('../utilities/random');

var _zeros = require('../utilities/zeros');

var _zeros2 = _interopRequireDefault(_zeros);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var RNN = function () {
  function RNN() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, RNN);

    var defaults = RNN.defaults;

    for (var p in defaults) {
      if (defaults.hasOwnProperty(p) && p !== 'isBackPropagate') {
        this[p] = options.hasOwnProperty(p) ? options[p] : defaults[p];
      }
    }

    this.stepCache = {};
    this.runs = 0;
    this.totalPerplexity = null;
    this.totalCost = null;
    this.ratioClipped = null;

    this.model = null;

    this.initialize();
  }

  _createClass(RNN, [{
    key: 'initialize',
    value: function initialize() {
      this.model = {
        input: null,
        hiddenLayers: [],
        output: null,
        equations: [],
        allMatrices: [],
        outputMatrixIndex: -1,
        equationConnections: []
      };

      if (this.json) {
        this.fromJSON(this.json);
      } else {
        this.mapModel();
      }
    }
  }, {
    key: 'createHiddenLayers',
    value: function createHiddenLayers() {
      var hiddenSizes = this.hiddenSizes;
      var model = this.model;
      var hiddenLayers = model.hiddenLayers;
      //0 is end, so add 1 to offset
      hiddenLayers.push(this.getModel(hiddenSizes[0], this.inputSize));
      var prevSize = hiddenSizes[0];

      for (var d = 1; d < hiddenSizes.length; d++) {
        // loop over depths
        var hiddenSize = hiddenSizes[d];
        hiddenLayers.push(this.getModel(hiddenSize, prevSize));
        prevSize = hiddenSize;
      }
    }

    /**
     *
     * @param {Number} hiddenSize
     * @param {Number} prevSize
     * @returns {object}
     */

  }, {
    key: 'getModel',
    value: function getModel(hiddenSize, prevSize) {
      return {
        //wxh
        weight: new _randomMatrix2.default(hiddenSize, prevSize, 0.08),
        //whh
        transition: new _randomMatrix2.default(hiddenSize, hiddenSize, 0.08),
        //bhh
        bias: new _matrix2.default(hiddenSize, 1)
      };
    }

    /**
     *
     * @param {Equation} equation
     * @param {Matrix} inputMatrix
     * @param {Matrix} previousResult
     * @param {Object} hiddenLayer
     * @returns {Matrix}
     */

  }, {
    key: 'getEquation',
    value: function getEquation(equation, inputMatrix, previousResult, hiddenLayer) {
      var relu = equation.relu.bind(equation);
      var add = equation.add.bind(equation);
      var multiply = equation.multiply.bind(equation);

      return relu(add(add(multiply(hiddenLayer.weight, inputMatrix), multiply(hiddenLayer.transition, previousResult)), hiddenLayer.bias));
    }
  }, {
    key: 'createInputMatrix',
    value: function createInputMatrix() {
      //0 is end, so add 1 to offset
      this.model.input = new _randomMatrix2.default(this.inputRange + 1, this.inputSize, 0.08);
    }
  }, {
    key: 'createOutputMatrix',
    value: function createOutputMatrix() {
      var model = this.model;
      var outputSize = this.outputSize;
      var lastHiddenSize = this.hiddenSizes[this.hiddenSizes.length - 1];

      //0 is end, so add 1 to offset
      //whd
      model.outputConnector = new _randomMatrix2.default(outputSize + 1, lastHiddenSize, 0.08);
      //0 is end, so add 1 to offset
      //bd
      model.output = new _matrix2.default(outputSize + 1, 1);
    }
  }, {
    key: 'bindEquation',
    value: function bindEquation() {
      var model = this.model;
      var hiddenSizes = this.hiddenSizes;
      var hiddenLayers = model.hiddenLayers;
      var equation = new _equation2.default();
      var outputs = [];
      var equationConnection = model.equationConnections.length > 0 ? model.equationConnections[model.equationConnections.length - 1] : hiddenSizes.map(function (size) {
        return new _matrix2.default(hiddenSizes[0], 1);
      });

      // 0 index
      var output = this.getEquation(equation, equation.inputMatrixToRow(model.input), equationConnection[0], hiddenLayers[0]);
      outputs.push(output);
      // 1+ indexes
      for (var i = 1, max = hiddenSizes.length; i < max; i++) {
        output = this.getEquation(equation, output, equationConnection[i], hiddenLayers[i]);
        outputs.push(output);
      }

      model.equationConnections.push(outputs);
      equation.add(equation.multiply(model.outputConnector, output), model.output);
      model.allMatrices = model.allMatrices.concat(equation.allMatrices);
      model.equations.push(equation);
    }
  }, {
    key: 'mapModel',
    value: function mapModel() {
      var model = this.model;
      var hiddenLayers = model.hiddenLayers;
      var allMatrices = model.allMatrices;

      this.createInputMatrix();
      if (!model.input) throw new Error('net.model.input not set');
      allMatrices.push(model.input);

      this.createHiddenLayers();
      if (!model.hiddenLayers.length) throw new Error('net.hiddenLayers not set');
      for (var i = 0, max = hiddenLayers.length; i < max; i++) {
        var hiddenMatrix = hiddenLayers[i];
        for (var property in hiddenMatrix) {
          if (!hiddenMatrix.hasOwnProperty(property)) continue;
          allMatrices.push(hiddenMatrix[property]);
        }
      }

      this.createOutputMatrix();
      if (!model.outputConnector) throw new Error('net.model.outputConnector not set');
      if (!model.output) throw new Error('net.model.output not set');

      allMatrices.push(model.outputConnector);
      model.outputMatrixIndex = allMatrices.length;
      allMatrices.push(model.output);
    }
  }, {
    key: 'trainPattern',
    value: function trainPattern(input) {
      var err = this.runInput(input);
      this.runBackpropagate(input);
      this.step();
      return err;
    }
  }, {
    key: 'runInput',
    value: function runInput(input) {
      this.runs++;
      var model = this.model;
      var max = input.length;
      var log2ppl = 0;
      var cost = 0;

      var equation = void 0;
      while (model.equations.length <= input.length + 1) {
        //first and last are zeros
        this.bindEquation();
      }
      for (var inputIndex = -1, inputMax = input.length; inputIndex < inputMax; inputIndex++) {
        // start and end tokens are zeros
        equation = model.equations[inputIndex + 1];

        var source = inputIndex === -1 ? 0 : input[inputIndex] + 1; // first step: start with START token
        var target = inputIndex === max - 1 ? 0 : input[inputIndex + 1] + 1; // last step: end with END token
        var output = equation.run(source);
        // set gradients into log probabilities
        var logProbabilities = output; // interpret output as log probabilities
        var probabilities = (0, _softmax2.default)(output); // compute the softmax probabilities

        log2ppl += -Math.log2(probabilities.weights[target]); // accumulate base 2 log prob and do smoothing
        cost += -Math.log(probabilities.weights[target]);

        // write gradients into log probabilities
        logProbabilities.recurrence = probabilities.weights;
        logProbabilities.recurrence[target] -= 1;
      }

      this.totalCost = cost;
      return this.totalPerplexity = Math.pow(2, log2ppl / (max - 1));
    }
  }, {
    key: 'runBackpropagate',
    value: function runBackpropagate(input) {
      var i = input.length + 0;
      var model = this.model;
      var equations = model.equations;
      while (i > 0) {
        equations[i].runBackpropagate(input[i - 1] + 1);
        i--;
      }
      equations[0].runBackpropagate(0);
    }
  }, {
    key: 'step',
    value: function step() {
      // perform parameter update
      var stepSize = this.learningRate;
      var regc = this.regc;
      var clipval = this.clipval;
      var model = this.model;
      var numClipped = 0;
      var numTot = 0;
      var allMatrices = model.allMatrices;
      var matrixIndexes = allMatrices.length;
      for (var matrixIndex = 0; matrixIndex < matrixIndexes; matrixIndex++) {
        var matrix = allMatrices[matrixIndex];
        if (!(matrixIndex in this.stepCache)) {
          this.stepCache[matrixIndex] = new _matrix2.default(matrix.rows, matrix.columns);
        }
        var cache = this.stepCache[matrixIndex];

        //if we are in an equation, reset the weights and recurrence to 0, to prevent exploding gradient problem
        if (matrixIndex > model.outputMatrixIndex) {
          for (var i = 0, n = matrix.weights.length; i < n; i++) {
            matrix.weights[i] = 0;
            matrix.recurrence[i] = 0;
          }
          continue;
        }

        for (var _i = 0, _n = matrix.weights.length; _i < _n; _i++) {
          // rmsprop adaptive learning rate
          var mdwi = matrix.recurrence[_i];
          cache.weights[_i] = cache.weights[_i] * this.decayRate + (1 - this.decayRate) * mdwi * mdwi;
          // gradient clip
          if (mdwi > clipval) {
            mdwi = clipval;
            numClipped++;
          }
          if (mdwi < -clipval) {
            mdwi = -clipval;
            numClipped++;
          }
          numTot++;

          // update (and regularize)
          matrix.weights[_i] = matrix.weights[_i] + -stepSize * mdwi / Math.sqrt(cache.weights[_i] + this.smoothEps) - regc * matrix.weights[_i];
          matrix.recurrence[_i] = 0; // reset gradients for next iteration
        }
      }
      this.ratioClipped = numClipped / numTot;
    }
  }, {
    key: 'run',
    value: function run() {
      var input = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
      var maxPredictionLength = arguments.length <= 1 || arguments[1] === undefined ? 100 : arguments[1];

      var _sampleI = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

      var temperature = arguments.length <= 3 || arguments[3] === undefined ? 1 : arguments[3];

      var model = this.model;
      var equation = void 0;
      var i = 0;
      var output = input.length > 0 ? input.slice(0) : [];
      while (model.equations.length < maxPredictionLength) {
        this.bindEquation();
      }
      while (true) {
        var ix = output.length === 0 ? 0 : output[output.length - 1];
        equation = model.equations[i];
        // sample predicted letter
        var outputIndex = equation.run(ix);

        var logProbabilities = new _matrix2.default(model.output.rows, model.output.columns);
        (0, _copy2.default)(logProbabilities, outputIndex);
        if (temperature !== 1 && _sampleI) {
          // scale log probabilities by temperature and renormalize
          // if temperature is high, logprobs will go towards zero
          // and the softmax outputs will be more diffuse. if temperature is
          // very low, the softmax outputs will be more peaky
          for (var q = 0, nq = logProbabilities.weights.length; q < nq; q++) {
            logProbabilities.weights[q] /= temperature;
          }
        }

        var probs = (0, _softmax2.default)(logProbabilities);

        if (_sampleI) {
          ix = (0, _sampleI3.default)(probs);
        } else {
          ix = (0, _maxI2.default)(probs);
        }

        i++;
        if (ix === 0) {
          // END token predicted, break out
          break;
        }
        if (i >= maxPredictionLength) {
          // something is wrong
          break;
        }

        output.push(ix);
      }

      return output.slice(input.length).map(function (value) {
        return value - 1;
      });
    }

    /**
     *
     * @param data
     * @param options
     * @returns {{error: number, iterations: number}}
     */

  }, {
    key: 'train',
    value: function train(data) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      options = Object.assign({}, options, RNN.trainDefaults);
      data = this.formatData(data);
      var iterations = options.iterations;
      var errorThresh = options.errorThresh;
      var log = options.log === true ? console.log : options.log;
      var logPeriod = options.logPeriod;
      var learningRate = options.learningRate || this.learningRate;
      var callback = options.callback;
      var callbackPeriod = options.callbackPeriod;
      var sizes = [];
      var inputSize = data[0].input.length;
      var outputSize = data[0].output.length;
      var hiddenSizes = this.hiddenSizes;
      if (!hiddenSizes) {
        sizes.push(Math.max(3, Math.floor(inputSize / 2)));
      } else {
        hiddenSizes.forEach(function (size) {
          sizes.push(size);
        });
      }

      sizes.unshift(inputSize);
      sizes.push(outputSize);

      if (!options.keepNetworkIntact) {
        this.initialize();
      }

      var error = 1;
      var i = void 0;
      for (i = 0; i < iterations && error > errorThresh; i++) {
        var sum = 0;
        for (var j = 0; j < data.length; j++) {
          var err = this.trainPattern(data[j].input);
          sum += err;
        }
        error = sum / data.length;

        if (log && i % logPeriod == 0) {
          log('iterations:', i, 'training error:', error);
        }
        if (callback && i % callbackPeriod == 0) {
          callback({ error: error, iterations: i });
        }
      }

      return {
        error: error,
        iterations: i
      };
    }

    /**
     *
     * @param learningRate
     */

  }, {
    key: 'adjustWeights',
    value: function adjustWeights(learningRate) {
      throw new Error('not yet implemented');
    }

    /**
     *
     * @param data
     * @returns {*}
     */

  }, {
    key: 'formatData',
    value: function formatData(data) {
      throw new Error('not yet implemented');
    }

    /**
     *
     * @param data
     * @returns {
     *  {
     *    error: number,
     *    misclasses: Array
     *  }
     * }
     */

  }, {
    key: 'test',
    value: function test(data) {
      throw new Error('not yet implemented');
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      var defaults = RNN.defaults;
      var model = this.model;
      var options = {};
      for (var p in defaults) {
        options[p] = this[p];
      }

      return {
        type: this.constructor.name,
        options: options,
        input: model.input.toJSON(),
        hiddenLayers: model.hiddenLayers.map(function (hiddenLayer) {
          var layers = {};
          for (var _p in hiddenLayer) {
            layers[_p] = hiddenLayer[_p].toJSON();
          }
          return layers;
        }),
        outputConnector: this.model.outputConnector.toJSON(),
        output: this.model.output.toJSON()
      };
    }
  }, {
    key: 'fromJSON',
    value: function fromJSON(json) {
      this.json = json;
      var defaults = RNN.defaults;
      var model = this.model;
      var options = json.options;
      var allMatrices = model.allMatrices;
      model.input = _matrix2.default.fromJSON(json.input);
      allMatrices.push(model.input);
      model.hiddenLayers = json.hiddenLayers.map(function (hiddenLayer) {
        var layers = {};
        for (var p in hiddenLayer) {
          layers[p] = _matrix2.default.fromJSON(hiddenLayer[p]);
          allMatrices.push(layers[p]);
        }
        return layers;
      });
      model.outputConnector = _matrix2.default.fromJSON(json.outputConnector);
      model.output = _matrix2.default.fromJSON(json.output);
      allMatrices.push(model.outputConnector, model.output);

      for (var p in defaults) {
        if (defaults.hasOwnProperty(p) && p !== 'isBackPropagate') {
          this[p] = options.hasOwnProperty(p) ? options[p] : defaults[p];
        }
      }

      this.bindEquation();
    }

    /**
     *
     * @returns {Function}
     */

  }, {
    key: 'toFunction',
    value: function toFunction() {
      var model = this.model;
      var equations = this.model.equations;
      var equation = equations[1];
      var states = equation.states;
      var modelAsString = JSON.stringify(this.toJSON());

      function matrixOrigin(m, stateIndex) {
        for (var i = 0, max = states.length; i < max; i++) {
          var state = states[i];

          if (i === stateIndex) {
            var j = previousConnectionIndex(m);
            switch (m) {
              case state.left:
                if (j > -1) {
                  return 'typeof prevStates[' + j + '] === \'object\' ? prevStates[' + j + '].product : new Matrix(' + m.rows + ', ' + m.columns + ')';
                }
              case state.right:
                if (j > -1) {
                  return 'typeof prevStates[' + j + '] === \'object\' ? prevStates[' + j + '].product : new Matrix(' + m.rows + ', ' + m.columns + ')';
                }
              case state.product:
                return 'new Matrix(' + m.rows + ', ' + m.columns + ')';
              default:
                throw Error('unknown state');
            }
          }

          if (m === state.product) return 'states[' + i + '].product';
          if (m === state.right) return 'states[' + i + '].right';
          if (m === state.left) return 'states[' + i + '].left';
        }
      }

      function previousConnectionIndex(m) {
        var connection = model.equationConnections[0];
        var states = equations[0].states;
        for (var i = 0, max = states.length; i < max; i++) {
          if (states[i].product === m) {
            return i;
          }
        }
        return connection.indexOf(m);
      }

      function matrixToString(m, stateIndex) {
        if (!m || !m.rows || !m.columns) return 'null';

        if (m === model.input) return 'model.input';
        if (m === model.outputConnector) return 'model.outputConnector';
        if (m === model.output) return 'model.output';

        for (var i = 0, max = model.hiddenLayers.length; i < max; i++) {
          var hiddenLayer = model.hiddenLayers[i];
          for (var p in hiddenLayer) {
            if (!hiddenLayer.hasOwnProperty(p)) continue;
            if (hiddenLayer[p] !== m) continue;
            return 'model.hiddenLayers[' + i + '].' + p;
          }
        }

        return matrixOrigin(m, stateIndex);
      }

      function toInner(fnString) {
        //crude, but should be sufficient for now
        // function() { body }
        fnString = fnString.toString().split('{');
        fnString.shift();
        // body }
        fnString = fnString.join('{');
        fnString = fnString.split('}');
        fnString.pop();
        // body
        return fnString.join('}').split('\n').join('\n        ');
      }

      function fileName(fnName) {
        return 'src/recurrent/matrix/' + fnName.replace(/[A-Z]/g, function (value) {
          return '-' + value.toLowerCase();
        }) + '.js';
      }

      var statesRaw = [];
      var usedFunctionNames = {};
      var innerFunctionsSwitch = [];
      for (var i = 0, max = states.length; i < max; i++) {
        var state = states[i];
        statesRaw.push('states[' + i + '] = {\n      name: \'' + state.forwardFn.name + '\',\n      left: ' + matrixToString(state.left, i) + ',\n      right: ' + matrixToString(state.right, i) + ',\n      product: ' + matrixToString(state.product, i) + '\n    }');

        var fnName = state.forwardFn.name;
        if (!usedFunctionNames[fnName]) {
          usedFunctionNames[fnName] = true;
          innerFunctionsSwitch.push('        case \'' + fnName + '\': //compiled from ' + fileName(fnName) + '\n          ' + toInner(state.forwardFn.toString()) + '\n          break;');
        }
      }

      return new Function('input', 'maxPredictionLength', '_sampleI', 'temperature', '\n  if (typeof input === \'undefined\') input = [];\n  if (typeof maxPredictionLength === \'undefined\') maxPredictionLength = 100;\n  if (typeof _sampleI === \'undefined\') _sampleI = false;\n  if (typeof temperature === \'undefined\') temperature = 1;\n  \n  var model = ' + modelAsString + ';\n  var _i = 0;\n  var result = input.slice(0);\n  var states = [];\n  var prevStates;\n  while (true) {\n    // sample predicted letter\n    var ix = result.length === 0 ? 0 : result[result.length - 1]; // first step: start with START token\n    var rowPluckIndex = ix; //connect up to rowPluck\n    prevStates = states;\n    states = [];\n    ' + statesRaw.join(';\n    ') + ';\n    for (var stateIndex = 0, stateMax = ' + statesRaw.length + '; stateIndex < stateMax; stateIndex++) {\n      var state = states[stateIndex];\n      var product = state.product;\n      var left = state.left;\n      var right = state.right;\n      \n      switch (state.name) {\n' + innerFunctionsSwitch.join('\n') + '\n      }\n    }\n    \n    var logProbabilities = state.product;\n    if (temperature !== 1 && _sampleI) {\n      // scale log probabilities by temperature and renormalize\n      // if temperature is high, logprobs will go towards zero\n      // and the softmax outputs will be more diffuse. if temperature is\n      // very low, the softmax outputs will be more peaky\n      for (var q = 0, nq = logProbabilities.weights.length; q < nq; q++) {\n        logProbabilities.weights[q] /= temperature;\n      }\n    }\n\n    var probs = softmax(logProbabilities);\n\n    if (_sampleI) {\n      ix = sampleI(probs);\n    } else {\n      ix = maxI(probs);\n    }\n    \n    _i++;\n    if (ix === 0) {\n      // END token predicted, break out\n      break;\n    }\n    if (_i >= maxPredictionLength) {\n      // something is wrong\n      break;\n    }\n\n    result.push(ix);\n  }\n\n  return result.map(function(value) { return value - 1; });\n  \n  function Matrix(rows, columns) {\n    this.rows = rows;\n    this.columns = columns;\n    this.weights = zeros(rows * columns);\n    this.recurrence = zeros(rows * columns);\n  }\n  ' + _zeros2.default.toString() + '\n  ' + _softmax2.default.toString() + '\n  ' + _random.randomF.toString() + '\n  ' + _sampleI3.default.toString() + '\n  ' + _maxI2.default.toString());
    }
  }]);

  return RNN;
}();

exports.default = RNN;


RNN.defaults = {
  isBackPropagate: true,
  // hidden size should be a list
  inputSize: 20,
  inputRange: 20,
  hiddenSizes: [20, 20],
  outputSize: 20,
  learningRate: 0.01,
  decayRate: 0.999,
  smoothEps: 1e-8,
  regc: 0.000001,
  clipval: 5,
  json: null
};

RNN.trainDefaults = {
  iterations: 20000,
  errorThresh: 0.005,
  log: false,
  logPeriod: 10,
  learningRate: 0.3,
  callback: null,
  callbackPeriod: 10,
  keepNetworkIntact: false
};
//# sourceMappingURL=rnn.js.map