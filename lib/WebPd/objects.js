/*
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
 *
 */

(function(Pd){


/************************** Basic objects ******************************/

    Pd.objects = {
    // null placeholder object for objects which don't exist
        'null': {},
        'cnv': {}
    };

    Pd.objects['text'] = Pd.Object.extend({

        load: function(text) {
            this.text = text;
        }

    });

    Pd.objects['loadbang'] = Pd.Object.extend({

        outletTypes: ['outlet'],

        load: function() {
            this.outlets[0].message('bang');
        }

    });

    Pd.objects['print'] = Pd.Object.extend({

        inletTypes: ['inlet'],

        init: function(printName) {
            this.printName = (printName || 'print');
        },

        message: function(inletId) {
            var msg = Array.prototype.slice.call(arguments, 1);
            console.log(this.printName + ': ' + msg.join(' '));
        }

    });

    Pd.objects['table'] = Pd.UniquelyNamedObject.extend({

        init: function(name, size) {
            this.name = name || null;
            this.size = size;
            this.data = new Pd.arrayType(size);
        }

    });

    Pd.objects['message'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet'],

        init: function() {
            this.setFilterMsg(Array.prototype.slice.call(arguments, 0));
        },

        setFilterMsg: function(filterMsg) {
            this.filterMsg = filterMsg;
            this.filter = Pd.makeMsgFilter(this.filterMsg);
        },

        message: function(inletId) {
            if (inletId === 0) {
                var msg = Array.prototype.slice.call(arguments, 1),
                    filtered, outlet;

                // outputs the filtered message
                outlet = this.outlets[0]; 
                outlet.message.apply(outlet, this.filter(msg));
            }
        }

    });

/**************************** Glue *********************************/

    var ArithmBase = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(val) {
            this.setVal(val || 0);
            this.lastResult = 0;
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        },

        message: function(inletId, val) {
            if (inletId === 0) {
                if (val !== 'bang') { 
                    this.assertIsNumber(val, 'value must be a number');
                    this.lastResult = this.compute(val);
                }
                this.outlets[0].message(this.lastResult);
            } else if (inletId === 1) this.setVal(val);
        },

        // Must be overriden
        compute: function(val) {
            return;
        }
    });

    Pd.objects['+'] = ArithmBase.extend({

        compute: function(val) {
            return val + this.val;
        }

    });

    Pd.objects['-'] = ArithmBase.extend({

        compute: function(val) {
            return val - this.val;
        }

    });

    Pd.objects['*'] = ArithmBase.extend({

        compute: function(val) {
            return val * this.val;
        }

    });

    Pd.objects['/'] = ArithmBase.extend({

        compute: function(val) {
            return val / this.val;
        }

    });

    Pd.objects['mod'] = ArithmBase.extend({

        compute: function(val) {
            return val % this.val;
        }

    });

    // Stores a float
    Pd.objects['float'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(val) {
            this.setVal(val || 0);
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'value must be a number');
            this._dollarVal = false;
            this.val = val;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (this._dollarVal) {
                    msg = Array.prototype.slice.call(arguments, 1);
                    msg = this.filter(msg)[0];
                }
                if (msg !== 'bang') this.setVal(msg);
                this.outlets[0].message(this.val);
            } else if (inletId === 1) this.setVal(msg);
        }
    });

    // Blocks messages or let them through depending on value on right inlet.
    Pd.objects['spigot'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(val) {
            this.setPassing(val || 0);
        },

        setPassing: function(val) {
            this.assertIsNumber(val, 'value must be a number');
            this.passing = Boolean(val);
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (this.passing) {
                    var outlet = this.outlets[0],
                        args = Array.prototype.slice.call(arguments, 1);
                    outlet.message.apply(outlet, args);
                }
            } else if (inletId === 1) this.setPassing(msg);
        }
    });

    // Blocks messages or let them through depending on value on right inlet.
    // TODO: validate filters
    Pd.objects['trigger'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: [],

        init: function() {
            var array = Array.prototype.slice.call(arguments, 0), 
                i, length;
            if (array.length === 0) array = ['bang', 'bang'];
            for (i = 0, length = array.length; i < length; i++) {
                this.outlets[i] = new Pd['outlet'](this, i);
            }
            this.filters = array;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var list = Array.prototype.slice.call(arguments, 1), 
                    i, length, filter, outlet;

                for (i = this.filters.length - 1; i >= 0; i--) {
                    filter = this.filters[i];
                    outlet = this.outlets[i];
                    if (filter === 'bang') outlet.message('bang');
                    else if (filter === 'list' || filter === 'anything')
                        outlet.message.apply(outlet, list);
                    else if (filter === 'float') {
                        msg = list[0];
                        if (Pd.isNumber(msg)) outlet.message(msg);
                        else outlet.message(0);
                    } else if (filter === 'symbol') {
                        msg = list[0];
                        if (msg === 'bang') outlet.message('symbol');
                        else if (Pd.isNumber(msg)) outlet.message('float');
                        else if (Pd.isString(msg)) outlet.message(msg);
                        else throw new Error('Got unexpected input ' + msg);
                    }
                }
            }
        }

    });

    // Checks the input message and routes it to the right inlet if it doesn't
    // correspond to any of the filters.
    // TODO : right inlet
    Pd.objects['select'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: [],

        init: function() {
            var array = Array.prototype.slice.call(arguments, 0), 
                i, length;

            for (i = 0, length = array.length; i < length; i++) {
                this.outlets[i] = new Pd['outlet'](this, i);
            }
            this.outlets[i] = new Pd['outlet'](this, i);
            this.filters = array;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var filters = this.filters, 
                    i, length;
                for (i = 0, length = filters.length; i < length; i++) {
                    if (msg === filters[i]) {
                        this.outlets[i].message('bang');
                        return;
                    }
                }
                this.outlets.slice(-1)[0].message(msg);
            }
        }

    });

    // Parts a stream of numbers
    Pd.objects['moses'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet', 'outlet'],

        init: function(val) {
            this.setVal(val || 0);
            this.lastResult = 0;
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        },

        message: function(inletId, val) {
            if (inletId === 0) {
                this.assertIsNumber(val, 'value must be a number');
                if (val < this.val) this.outlets[0].message(val);
                else this.outlets[1].message(val);
            } else if (inletId === 1) this.setVal(val);
        }

    });

    // Convert midi notes to frequency
    Pd.objects['mtof'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet'],
        maxMidiNote: 8.17579891564 * Math.exp((0.0577622650 * 1499)),

        // TODO: round output ?
        message: function(inletId, note) {
            if (inletId === 0) {
                this.assertIsNumber(note, 'invalid midi note ' + note);
                var out = 0;
                if (note <= -1500) out = 0;
                else if (note > 1499) out = this.maxMidiNote;
                else out = 8.17579891564 * Math.exp((0.0577622650 * note));
                this.outlets[0].message(out);
            }
        }
    });

    // Random number generator
    Pd.objects['random'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(maxInt) {
            this.setMax(maxInt || 1);
        },

        setMax: function(maxInt) {
            this.assertIsNumber(maxInt, 'invalid maximum ' + maxInt);
            this.max = maxInt;
        },

        message: function(inletId, arg1, arg2) {
            if (inletId === 0) {
                if (arg1 === 'bang') this.outputRandomInt();
                else if (arg1 === 'seed'); // TODO: seeding, not available with `Math.rand`
            } else if (inletId === 1) this.setMax(arg1);
        },

        outputRandomInt: function() {
            this.outlets[0].message(Math.floor(Math.random() * this.max));
        }

    });

    // Metronome, outputs 'bang' every `rate` milliseconds.
    // TODO: sample-exactitude ? How does it work in pd ?
    Pd.objects['metro'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(rate) {
            this.setRate(rate || 0);
            this.toDspTickNoOp();
            this._intervalId = null;
            this._metroTick = this._metroTickNormal;
        },

        // Metronome rate, in ms per tick
        setRate: function(rate) {
            this.assertIsNumber(rate, 'invalid rate ' + rate);
            this.rate = rate;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'bang') this._restartMetroTick();
                else if (msg === 'stop') this._stopMetroTick(); 
                else {
                    this.assertIsNumber(msg, 'invalid msg ' + msg);
                    if (msg === 0) this._stopMetroTick();
                    else this._restartMetroTick();
                }
            } else if (inletId === 1) {
                this.setRate(msg);
                this._metroTick = this._metroTickRateChange;
            }
        },

        _startMetroTick: function() {
            this._metroTick();
            if (this._intervalId === null) {
                this._intervalId = this.patch.interval(this.rate, function() { this._metroTick(); }, this);
            }
        },

        _stopMetroTick: function() {
            if (this._intervalId !== null) {
                this.patch.clear(this._intervalId);
                this._intervalId = null;
            }
        },

        _restartMetroTick: function() {
            this._stopMetroTick();
            this._startMetroTick();
        },

        _metroTickNormal: function() { this.outlets[0].message('bang'); },

        // Ticks, restarts the interval and switches to normal ticking.
        // This is useful when the rate was changed.
        _metroTickRateChange: function() {
            this._metroTick = this._metroTickNormal;
            this._restartMetroTick();
        }
    });

    // Delay, outputs 'bang' after a given time in milliseconds.
    // TODO: sample-exactitude ? How does it work in pd ?
    Pd.objects['delay'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(delay) {
            this.setDelay(delay || 0);
            this.toDspTickNoOp();
            this._timeoutId = null;
        },

        // Delay time, in ms
        setDelay: function(delay) {
            this.assertIsNumber(delay, 'invalid delay ' + delay);
            this.delay = delay;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'bang') {
                    this._stopDelay();
                    this._startDelay();
                } else if (msg === 'stop') this._stopDelay(); 
                else {
                    this.setDelay(msg);
                    this._stopDelay();
                    this._startDelay();
                }
            } else if (inletId === 1) this.setDelay(msg);
        },

        _startDelay: function() {
            if (this._timeoutId === null) {
                this._timeoutId = this.patch.timeout(this.delay, this._delayReached, this);
            }
        },

        _stopDelay: function() {
            if (this._timeoutId !== null) {
                this.patch.clear(this._timeoutId);
                this._timeoutId = null;
            }
        }, 

        _delayReached: function() { this.outlets[0].message('bang'); }
    });

    // TODO: How does it work in pd ?
    // TODO: frameRate change ?
    Pd.objects['timer'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function() {
            // Reference frame, the timer count starts from this  
            this.refFrame = 0;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                this.assertIsBang(msg, 'unvalid message : ' + msg);
                this.refFrame = this.patch.frame;
            } else if (inletId === 1) {
                var patch = this.patch;
                this.assertIsBang(msg, 'unvalid message : ' + msg);
                this.outlets[0].message((patch.frame - this.refFrame) *  
                    patch.blockSize * 1000 / patch.sampleRate);
            }
        }

    });

    Pd.objects['receive'] = Pd.NamedObject.extend({

        inletTypes: [],
        outletTypes: ['outlet'],

        init: function(name) {
            var onMsgReceived = this._messageHandler();
            this.on('change:name', function(oldName, newName) {
                var patch = this.patch;
                if (patch) {
                    if (oldName) patch.removeListener('msg:' + oldName, onMsgReceived);
                    patch.on('msg:' + newName, onMsgReceived);
                }
            });
            this.setName(name);
        },

        _messageHandler: function() {
            var self = this;
            return function() {
                var outlet = self.outlets[0];
                outlet.message.apply(outlet, arguments);
            };
        }

    });

    Pd.objects['send'] = Pd.NamedObject.extend({

        inletTypes: ['inlet'],
        outletTypes: [],

        init: function(name) {
            this.setName(name);
        },

        message: function(inletId) {
            if (inletId === 0) {
                var patch = this.patch,
                    args = Array.prototype.slice.call(arguments, 1);

                patch.send.apply(patch, [this.name].concat(args));
            }
        }

    });

/**************************** Lists *********************************/

    Pd.objects['list split'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet', 'outlet', 'outlet'],

        init: function(splitInd) {
            this.setSplitInd(splitInd || 0);
        },

        setSplitInd: function(ind) {
            this.assertIsNumber(ind, 'split point must be a number');
            this.splitInd = ind;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var list = Array.prototype.slice.call(arguments, 1);
                if (this.splitInd > list.length) this.outlets[2].message('bang');
                else {
                    var outlet;
                    if (this.splitInd === list.length) this.outlets[1].message('bang');
                    else {
                        outlet = this.outlets[1];
                        outlet.message.apply(outlet, list.slice(this.splitInd, list.length));
                    }
                    if (this.splitInd === 0) this.outlets[0].message('bang');
                    else {
                        outlet = this.outlets[0];
                        outlet.message.apply(outlet, list.slice(0, this.splitInd));
                    }
                }
            } else if (inletId === 1) this.setSplitInd(msg);
        }

    });


/************************** DSP objects ******************************/
  
    // Basic oscillator
    Pd.objects['osc~'] = Pd.Object.extend({
        // TODO : reset phase takes float and no bang
        // TODO : recalculate stuff on sample rate change. (Useless ?)

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.setFreq(freq || 0);
            this.phase = 0;
            this.dspTick = this.dspTickConstFreq;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setFreq(this.freq);
            // TODO: this needs to be recalculated on sampleRate change
            this.J = 2 * Math.PI / this.patch.sampleRate;
        },

        // Sets the frequency for the constant frequency dspTick method.
        setFreq: function(freq) {
            this.assertIsNumber(freq, 'frequency must be a number');
            this.freq = freq;
            // TODO: this needs to be recalculated on sampleRate change
            if (this.patch) this.K = 2 * Math.PI * this.freq / this.patch.sampleRate;
        },

        // Calculates the cos taking the frequency from dsp inlet
        dspTickVariableFreq: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                J = this.J, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase += J * inBuff[i];
                outBuff[i] = Math.cos(phase);
            }
            this.phase = phase;
        },

        // Calculates the cos with a constant frequency from first inlet
        dspTickConstFreq: function() {
            var outBuff = this.outlets[0].getBuffer(),
                K = this.K, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase += K;
                outBuff[i] = Math.cos(phase);
            }
            this.phase = phase;
        },

        message: function(inletId, msg) {
            if (inletId === 0) this.setFreq(msg);
            else if (inletId === 1 && msg === 'bang') this.phase = 0;
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickVariableFreq;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickConstFreq;
            }
        }

    });

    // Sawtooth generator
    Pd.objects['phasor~'] = Pd.Object.extend({
        // TODO : reset phase
        // TODO : recalculate stuff on sample rate change. (Useless ?)
        // TODO : lots of common code between osc~ and phasor~ 

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.setFreq(freq || 0);
            this.dspTick = this.dspTickConstFreq;
            this.phase = 0;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setFreq(this.freq);
            // TODO: this needs to be recalculated on sampleRate change
            this.J = 1 / this.patch.sampleRate;
        },

        // Sets the frequency for the constant frequency dspTick method.
        setFreq: function(freq) {
            this.assertIsNumber(freq, 'frequency must be a number');
            this.freq = freq;
            // TODO: this needs to be recalculated on sampleRate change
            if (this.patch) this.K = this.freq / this.patch.sampleRate;
        },

        // Calculates the sawtooth taking the frequency from dsp inlet
        dspTickVariableFreq: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                J = this.J, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase = (phase + J * inBuff[i]) % 1;
                outBuff[i] = phase;
            }
            this.phase = phase;
        },

        // Calculates the sawtooth with a constant frequency from first inlet
        dspTickConstFreq: function() {
            var outBuff = this.outlets[0].getBuffer(),
                K = this.K, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++, phase++) {
                phase = (phase + K) % 1;
                outBuff[i] = phase;
            }
            this.phase = phase;
        },

        message: function(inletId, msg) {
            if (inletId === 0) this.setFreq(msg);
            else if (inletId === 1 && msg === 'bang') this.phase = 0;
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickVariableFreq;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickConstFreq;
            }
        }

    });

    // White noise generator 
    Pd.objects['noise~'] = Pd.Object.extend({

        outletTypes: ['outlet~'],

        dspTick: function() {
            var outBuff = this.outlets[0].getBuffer(),
                J = this.J, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = 2 * Math.random() - 1;
            }
        }
    });

    // digital to analogue converter (sound output)
    Pd.objects['dac~'] = Pd.Object.extend({

      endPoint: true,
      inletTypes: ['inlet~', 'inlet~'],

      dspTick: function() {
          var inBuff1 = this.inlets[0].getBuffer(),
              inBuff2 = this.inlets[1].getBuffer(),
              output = this.patch.output,
              i, length;

          // copy interleaved data from inlets to the graph's output buffer
          for (i = 0, length = output.length; i < length; i++) {
              output[i * 2] += inBuff1[i];
              output[i * 2 + 1] += inBuff2[i];
          }
      }
    });

    // creates simple dsp lines
    Pd.objects['line~'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet~'],

        init: function() {
            // what the value was at the start of the line
            this.y0 = 0;
            // the destination value we are aiming for
            this.y1 = 0;
                  // this stores the current index 
                  this.n = 0;
            // this stores the index max the line must reach
            this.nMax = 0;
            // we want to use the dsptick method that returns a constant value for now
            this.toDspConst(this.y0);
        },

        // write a constant value to our output buffer for every sample
        dspTickConst: function() {
            var outBuff = this.outlets[0].getBuffer(),
                i, length, y0 = this.y0;

            for (i = 0, length = outBuff.length; i < length; i++) outBuff[i] = y0;
        },

        // write this correct value of the line at each sample
        dspTickLine: function() {
            var outBuff = this.outlets[0].getBuffer(),
                outBuffLength = outBuff.length,
                slope = this.slope,
                i, j;

            for (i = 0; i < outBuffLength; i++, this.n++) {
                // if we've reached the end of our line, we fill-in the rest of the buffer,
                // break, and switch back to the constant method.
                if (this.n >= this.nMax) {
                    for (j = i; j < outBuffLength; j++) outBuff[j] = this.y1;
                    this.toDspConst(this.y1);
                    this.emit('end');
                    break;
                } else {
                    outBuff[i] = this.n * slope + this.y0;
                }
            }
        },

        message: function(inletId, y1, duration) {
            if (inletId === 0) {
                // if this is a single valued message we want line~ to output a constant value,
                // otherwise the message is taken as [targetY duration(
                this.assertIsNumber(y1, 'invalid value ' + y1);
                if (duration !== undefined) {
                    this.assertIsNumber(duration, 'invalid duration ' + duration);
                    this.toDspLine(y1, duration);
                } else {
                    this.toDspConst(y1);
                }
            }
        },

        toDspConst: function(val) {
            this.y0 = val;
            this.dspTick = this.dspTickConst;
        },

        toDspLine: function(val, duration) {
            this.y1 = val;
            this.n = 0;
            this.nMax = duration * this.patch.sampleRate / 1000;
            this.slope = (this.y1 - this.y0) / this.nMax;
            this.dspTick = this.dspTickLine;
        }
    });  


/************************** DSP arithmetics ******************************/

    var DSPArithmBase = Pd.Object.extend({

        inletTypes: ['inlet~', 'inlet~'],
        outletTypes: ['outlet~'],

        init: function(val) {
            this.setVal(val || 0);
            this.dspTick = this.dspTickConstant;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        }, 

        message: function(inletId, val) {
            if (inletId === 1) this.setVal(val);
        },

        // This is the dspTick method used when there is a dsp connection in inlet 1
        dspTickVariable: Pd.notImplemented,

        // This is the dspTick method used when there is NO dsp connection in inlet 1
        dspTickConstant: Pd.notImplemented,

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[1].hasDspSources()) {
                this.dspTick = this.dspTickVariable;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[1].hasDspSources()) {
                this.dspTick = this.dspTickConstant;
            }
        }
    });

    // dsp multiply object
    Pd.objects['*~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] * inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] * val;
            }
        }

    });

    // dsp divide object (d_arithmetic.c line 454 - over_perform() )
    Pd.objects['/~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val2, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                val2 = inBuff2[i];
                outBuff[i] = (val2 ? inBuff1[i] / val2 : 0);
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = (val ? inBuff1[i] / val : 0);
            }
        }

    });

    // dsp addition object
    Pd.objects['+~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] + inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] + val;
            }
        }

    });

    // dsp substraction object
    Pd.objects['-~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] - inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] - val;
            }
        }

    });

/************************** DSP tables ******************************/

    // Baseclass for tabwrite~, tabread~ and others ...
    var DSPTabBase = Pd.Object.extend({

        init: function(tableName) {
            this.tableName = tableName;
            this.table = null;
        },

        load: function() {
            this.setTableName(this.tableName);
        },

        setTableName: function(name) {
            var oldName = this.tableName;
            this.tableName = name;
            if (this.patch) {
                var table = Pd.getUniquelyNamedObject('table', name);
                if (!table) throw (new Error('table with name ' + name + ' doesn\'t exist'));
                this.table = table;
            }
            this.emit('change:tableName', oldName, name);
        }
    });

    // read data from a table with no interpolation
    Pd.objects['tabread~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.toDspTickZeros();
            this.on('change:tableName', function() {
                this.dspTick = this.dspTickReading;
            });
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                tableMax = this.table.size - 1,
                tableData = this.table.data,
                s, i, length;

            // cf. pd : Incoming values are truncated to the next lower integer,
            // and values out of bounds get the nearest (first or last) point.
            for (i = 0, length = outBuff.length; i < length; i++) {
                s = Math.floor(inBuff[i]);
                outBuff[i] = tableData[(s >= 0 ? (s > tableMax ? tableMax : s) : 0)];
            }
        },

        message: function(inletId, method, arg) {
            if (inletId === 0) {
                if (method === 'set') this.setTableName(arg);
            }
        }
    });

    // read data from a table with interpolation
    // TODO: onset (inlet 1)
    // TODO: use the real Pd algo (right now this is a simple linear interpolation, no 4-points)
    Pd.objects['tabread4~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.toDspTickZeros();
            this.on('change:tableName', function() {
                this.dspTick = this.dspTickReading;
            });
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                tableMax = this.table.size - 1,
                tableData = this.table.data,
                x, x1, x2, y1, y2, i, length;

            // cf. pd : Incoming values are truncated to the next lower integer,
            // and values out of bounds get the nearest (first or last) point.
            for (i = 0, length = outBuff.length; i < length; i++) {
                x = inBuff[i];
                x1 = Math.floor(x);
                x2 = Math.ceil(x);
                x1 = (x1 >= 0 ? (x1 > tableMax ? tableMax : x1) : 0);
                x2 = (x2 >= 0 ? (x2 > tableMax ? tableMax : x2) : 0);
                if (x1 === x2) outBuff[i] = tableData[x1];
                else {
                    y1 = tableData[x1];
                    y2 = tableData[x2];
                    outBuff[i] = y1 + (x - x1) * (y2 - y1);
                }
            }
        },

        message: function(inletId, method, arg) {
            if (inletId === 0) {
                if (method === 'set') this.setTableName(arg);
            }
        }
    });

    // play data from a table with no interpolation
    Pd.objects['tabplay~'] = DSPTabBase.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.pos = 0;
            this.posMax = 0;        // the position after the last position to be read
            this.toDspTickZeros();
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                iMax = Math.min(outBuff.length, this.posMax - this.pos),
                i, j, length;

            for (i = 0; i < iMax; i++, this.pos++) {
                outBuff[i] = this.table.data[this.pos];
            }
            // If we've reached the last position, that's it
            if (this.pos === this.posMax) {
                Pd.fillWithZeros(outBuff, i);
                this.toDspTickZeros();
                this.emit('end');
            }
        },

        message: function(inletId, arg1, arg2) {
            if (inletId === 0) {
                if (arg1 === 'set') {
                    this.setTableName(arg2);
                    this.toDspTickZeros();
                } else if (arg1 === 'bang') {
                    this.toDspTickReading(0);
                } else if (arg1 !== undefined) {
                    this.assertIsNumber(arg1, 'not a valid start position ' + arg1);
                    if (arg2 !== undefined) {
                        this.assertIsNumber(arg2, 'not a valid sample number ' + arg2);
                        this.toDspTickReading(arg1, arg2);
                    } else {
                        this.toDspTickReading(arg1);
                    }
                }
            }
        },

        toDspTickReading: function(startPos, sampleNum) {
            if (startPos >= this.table.size - 1) return;
            sampleNum = sampleNum || (this.table.size - startPos);
            this.pos = startPos;
            this.posMax = Math.min(startPos + sampleNum, this.table.size);
            this.dspTick = this.dspTickReading;
        }

    });

    // read data from a table with no interpolation
    Pd.objects['tabwrite~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        endPoint: true,

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.pos = 0;
            this.toDspTickNoOp();
        },

        dspTickWriting: function() {
            var inBuff = this.inlets[0].getBuffer();
            var iMax = Math.min(inBuff.length, this.table.size - this.pos);
            for (var i=0; i<iMax; i++, this.pos++) {
                this.table.data[this.pos] = inBuff[i];
            }
            // If we reached table size, that's it
            if (this.pos === this.table.size) {
                this.toDspTickNoOp();
                this.emit('end');
            }
        },

        message: function(inletId, command, arg) {
            if (inletId === 0) {
                if (command === 'bang') {
                    this.toDspTickWriting(0);
                } else if (command === 'stop') {
                    this.toDspTickNoOp();
                } else if (command === 'set') {
                    this.setTableName(arg);
                    this.toDspTickNoOp();
                } else if (command === 'start') {
                    var pos = 0;
                    if (arg !== undefined) {
                        this.assertIsNumber(arg, 'invalid start position ' + arg);
                        pos = Math.floor(arg);
                    }
                    this.toDspTickWriting(pos);
                }
            }
        },

        toDspTickWriting: function(start) { 
            this.dspTick = this.dspTickWriting;
            this.pos = start;
        }
    });

    // Let each object know of what type it is
    // TODO: all object types should register with Pd.register 
    var proto, type;
    for (type in Pd.objects) {
        if (proto = Pd.objects[type].prototype) proto.type = type;
    }

})(this.Pd);
