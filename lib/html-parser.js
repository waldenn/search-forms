const { EventEmitter } = require('events');
const htmlparser2 = require('htmlparser2');
const Ultron = require('ultron');
const Request = require('request');
const url = require('url');

const events = [
  "attribute",
  "cdatastart",
  "cdataend",
  "text",
  "processinginstruction",
  "comment",
  "commentend",
  "closetag",
  "opentag",
  "opentagname"
];

const methods = [
  'write',
  'end',
  'pause',
  'resume',
  'reset'
];

class Parser extends EventEmitter {
  constructor(options = {}) {
    super();

    const parser = new htmlparser2.Parser({}, options);
    const ultron = new Ultron(parser);

    methods.forEach(name => this[name] = parser[name].bind(parser));

    let self = this;

    this.isolate = callback => {
      self = new EventEmitter();
      try {
        callback(new Ultron(self));
      }
      catch(error) {
        this.emit('error', error);
      }
      self = this;
    };

    function emit(name, ...args) {
      self.emit(name, ...args);
    }

    this.on('newListener', name => {
      if (-1 === this.eventNames().indexOf(name)) {
        const callback = emit.bind(null, name);

        if (events.indexOf(name) !== -1) {
          parser._cbs['on' + name] = callback;
        }
        else {
          ultron.on(name, callback);
        }
      }
    });

    this.on('removeListener', name => {
      if (this.listeners(name).length === 0) {
        if (events.indexOf(name) !== -1) {
          parser._cbs['on' + name] = false;
        }
        else {
          ultron.remove(name);
        }
      }
    });

    Object.assign(this, {
      promises: [],
      forms: [],
      options: { ...parser._options, ...options }
    })

    this.apply(this, this.options);
  }
  get ultron() {
    return new Ultron(this);
  }
  apply(parser, options) {}
  chain(parser, options) {
    if (typeof parser === 'function' && !(parser instanceof Parser)) {
      parser = parser.prototype;
    }

    if (!parser || typeof parser.apply !== 'function') {
      throw new TypeError('Expected parser constructor/instance'
        + ' got type of ' + typeof(parser) + ' instead.');
    }

    parser.apply(this, Object.assign(this.options, options))
  }
  performRequest(options, callback = noop) {
    let result, { request, location } = this.options;

    if (location) options.uri = url.resolve(location, options.uri);

    if (typeof request !== 'function') {
      options = { ...options, ...request };
      request = Request;
    }

    this.promises.push(new Promise((resolve, reject) => {
      try {
        request(options, (error, response, body) => {
          callback(error, response, body);
          resolve();
        });
      }
      catch(error) {
        callback(error);
      }
    }));
  }
  requests() {
    const awaiting = [], { promises } = this;
    return new Promise(function executor(resolve, reject) {
      const added = [];

      promises.forEach(p => {
        if (-1 === awaiting.indexOf(p)) {
          awaiting.push(p);
          added.push(p);
        }
      });

      if (added.length > 0) {
        Promise.all(added).then(() => executor(resolve, reject), reject);
      }
      else {
        resolve();
      }
    });
  }
  collect(type, element) {
    this.emit(type, element);
  }
}

module.exports = { Parser };

function noop() {
 // No operation
}
