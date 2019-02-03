const { Parser } = require('./html-parser');
const levenshtein = require('js-levenshtein');
const url = require('url');

// @TODO: Add *
// * support for the select element and child option elements
// * a way to get the parser.forms filtered and sorted
// * support for inputs nested under labels
// * support for labels outside of forms
// * support for inputs outside of forms

const prefers = [
  '^[\\sq]+$',
  'se[ar]{0,2}ch',
  'query',
  'keyword'
];

const avoids = [
  'captcha',
  'auth',
  'log(in|out)',
  'challenge',
  'user',
  'pass',
  'email',
  'quick'
];

class SearchForm {
  constructor(attribs) {
    Object.assign(this, {
      attribs, data: {}, params: [], inputs: [], labels: {}
    });

    if ('POST' === ('' + attribs.method).toUpperCase()) {
      this.options = { uri: attribs.action, method: 'POST' };
    }
    else {
      this.options = { uri: attribs.action, method: 'GET'  };
    }
  }
  search(terms = '') {
    const options = { ...this.options };

    if (!this.isTemplate && this.params.length > 0) {
      const param = this.params[-1 === this.paramIndex ? 0 : this.paramIndex];
      this.data[param] = terms;
    }

    if (Object.keys(this.data).length > 0) {
      if (options.method === 'GET') {
        options.qs = this.data;
      }
      else {
        options.form = this.data;
      }
    }

    return options;
  }
}

Object.assign(SearchForm.prototype, {
  type: 'search-form',
  paramIndex: -1,
  confidence: 0,
  isTemplate: false,
  toString() {
    return '[' + this.type + ']';
  }
});

class SearchFormParser extends Parser {
  constructor(options) {
    super(options);
  }
  getSearchForms(html, sof = 0) {
    if (typeof html !== 'string') {
      throw new TypeError('Expected html to be type of string, '
        + 'got type of ' + typeof html + ' instead.');
    }

    sof = isNaN(parseInt(sof)) ? html.indexOf('<body>') : sof;
    if (sof > 0) html = html.slice(sof);

    const forms = [];
    const re = /<form [\S\s]*?<\/form>/gi;

    this.on('search-form', candidate => forms.push(candidate));

    let match;
    while ((match = re.exec(html)) !== null) this.write(match[0]);

    return this.sortForms.call({ forms });
  }
  apply(parser, options) {
    if (!('threshold' in options)) {
      options.threshold = 20;
    }

    parser.prefersRegex = createRegex(this.prefers, options.prefers);
    parser.avoidsRegex  = createRegex(this.avoids,  options.avoids);

    parser.getSearchForms = this.getSearchForms;
    parser.collect = this.collect;
    parser.sortForms = this.sortForms;

    let form, isFirst = true;

    const { ultron } = parser;

    ultron.on('closetag', name => {
      if (name === 'form') form = undefined;
    });

    ultron.on('opentag', function onopentag(name, attribs) {
      if (name === 'form') {
        form = new SearchForm(attribs);

        if (isFirst) {
          form.confidence += 10;
          isFirst = false;
        }

        rate(parser, form, attribs);

        if (attribs.action) {
          form.confidence += 1;

          if (/^[a-z]+:/i.test(attribs.action) &&
              !/^https?:/.test(attribs.action)) {
            form = undefined;
          }
        }

        return;
      }

      if (form !== undefined) {
        if (name === 'label' && attribs['for']) {
          ultron.once('opentag', () => ultron.off('text'));
          ultron.once('text', text => {
            forms.labels[attribs['for']] = { text };
          });

          return;
        }

        if (name !== 'input' || !attribs.name) return;

        const input = attribs;
        const type = input.type ? input.type.toLowerCase() : 'text';

        let hasValue = input.value !== undefined;

        switch (type) {
          case 'search':
            if (-1 === form.paramIndex) {
              form.paramIndex = form.params.length;
            }
          case 'text':
            form.confidence += 1;

            if (1 === form.params.push(input.name)) {
              parser.collect('search-form', form);
            }

            break;
          case 'hidden':
            if (hasValue) form.confidence += 3;

            break;
          case 'checkbox':
          case 'radio':
            if (input.checked === undefined) hasValue = false;
            if (hasValue) form.confidence += 1;

            break;
          case 'submit':
            break;
          default:
            form.confidence -= 1;

            if (type.indexOf('text') !== -1 ||
                levenshtein(type, 'text') <= 2) {
              input.type = 'text';
              onopentag(name, input);
              return;
            }

            if (type.indexOf('search') !== -1 ||
                levenshtein(type, 'search') <= 2) {
              input.type = 'search';
              onopentag(name, input);
              return;
            }
        }

        rate(parser, form, input);

        if (input.id && form.labels[input.id]) {
          rate(parser, form, form.labels[input.id]);
        }

        if (hasValue) form.data[input.name] = input.value;

        form.inputs.push(input);
      }
    });
  }
  collect(type, element) {
    if (type === 'search-form') {
      if (!(element instanceof SearchForm)) {
        throw new TypeError('Expected element to be form instance, got '
          + 'type of' + typeof(form) + ' instead.');
      }

      const { location } = this.options;

      if (location) {
        const { action: uri } = element.attribs;
        if (uri.indexOf('//') === 0) {
          this.options.uri = url.resolve(location, this.options.uri);
        }
        else if (uri.indexOf('://') === -1) {
          element.options.baseUrl = location;
        }
      }

      this.forms.push(element);
    }

    super.collect(type, element);
  }
  sortForms() {
    const threshold = this.options.threshold | 0;

    return this.forms.sort((a, b) => b.confidence - a.confidence)
      .filter(candidate => candidate.confidence >= threshold);
  }
}

Object.assign(SearchFormParser.prototype, { prefers, avoids });

module.exports = { SearchFormParser, SearchForm };

function createRegex(defaults, keywords) {
  const words = defaults.slice(0);

  if (Array.isArray(keywords)) {
    keywords.forEach(w => {
      if (-1 === words.indexOf(w)) words.push(w);
    });
  }

  return new RegExp(words.join('|'), 'i');
}

function rate(parser, form, attribs) {
  const keys = Object.keys(attribs);

  for (let i = 0; i < keys.length; i++) {
    if (parser.avoidsRegex.test(attribs[keys[i]])) {
      form.confidence -= 10;
    }
    if (parser.prefersRegex.test(attribs[keys[i]])) {
      form.confidence += 10;
    }
  }
}
