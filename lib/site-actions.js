const { Parser } = require('./html-parser');
const { SearchForm } = require('./forms');

// https://developers.google.com/search/docs/data-types/sitelinks-searchbox

class SiteActionForm extends SearchForm {
  constructor(attribs) {
    super(attribs);
  }
  search(terms = '') {
    this.options.uri = this.options.uri
      .replace(this.attribs.param, encodeURIComponent(terms));

    return super.search(terms);
  }
}

Object.assign(SiteActionForm.prototype, {
  type: 'site-action',
  isTemplate: true,
  confidence: 100
});

class SiteActionParser extends Parser {
  constructor(options) {
    super(options);
  }
  static getSearchAction(html, eof = -1) {
    if (typeof html !== 'string') {
      throw new TypeError('Expected html to be type of string, '
        + 'got type of ' + typeof html + ' instead.');
    }

    eof = isNaN(parseInt(eof)) ? html.indexOf('</head>') : eof;
    if (eof > 0) html = html.slice(0, eof);

    const re = new RegExp('<script[^>]*\\s+type='
       + '(["\'])application/ld\\+json\\1[^>]*>'
       + '([\\S\\s]*?)</script>', 'gi');

    let match, form;
    while ((match = re.exec(html)) !== null) {
      if ((form = SiteActionParser.parse(match[2])) !== undefined) {
        return form;
      }
    }

    return null;
  }
  apply(parser, options) {
    parser.getSearchAction = SiteActionParser.getSearchAction;

    const { ultron } = parser;

    ultron.on('closetag', name => {
      if (name === 'head') ultron.remove();
    });

    ultron.on('opentag', (name, attribs) => {
      if (name === 'script' && attribs.type &&
          /^application\/ld\+json$/i.test(attribs.type)) {
        ultron.once('text', structuredData => {
          try {
            const form = SiteActionParser.parse(structuredData);

            if (form !== undefined) {
              ultron.remove();

              parser.collect('search-form', form);
            }
          }
          catch(error) {}
        });

        return;
      }
    });
  }
  static parse(structuredData) {
    const website = typeof structuredData === 'string' ?
      JSON.parse(structuredData) : structuredData;

    if (!website['@type'] || !/^WebSite$/i.test(website['@type'])) return;

    const actions = Array.isArray(website.potentialAction) ?
      website.potentialAction : [ website.potentialAction ];

    const length = actions.length > 2 ? 2 : actions.length;

    for (let match, search, i = 0; i < length; i++) {
      if (search = actions[i]) {
        const { target, '@type': type, 'query-input': query } = search;

        if (target && type === 'SearchAction') {
          if (query && (match = query.match(/\bname=(\w+)/)) !== null) {
            match = target.match(new RegExp('({' + match[1] + '})', 'i'));
          }

          if (match === null) {
            match = target.match(/({search_term_string})/i);
          }

          if (match !== null) {
            return new SiteActionForm({ action: target, param: match[1] });
          }
        }
      }
    }
  }
}

module.exports =  { SiteActionParser };
