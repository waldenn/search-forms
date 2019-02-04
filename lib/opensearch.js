const { Parser } = require('./html-parser');
const { SearchForm } = require('./forms');

// https://developer.mozilla.org/en-US/docs/Web/OpenSearch

class OpenSearchForm extends SearchForm {
  constructor(attribs) {
    super(attribs);
  }
  search(terms = '') {
    Object.keys(this.data).forEach(param => {
      this.data[param].replace(/{searchTerms}/gi, terms);
    });

    this.options.uri = this.options.uri
      .replace(/{searchTerms}/gi, encodeURIComponent(terms));

    return super.search(terms);
  }
}

Object.assign(OpenSearchForm.prototype, {
  type: 'open-search',
  isTemplate: true,
  confidence: 100
});

class OpenSearchParser extends Parser {
  constructor(options) {
    super(options);
  }
  getOpenSearchLink(html, eof = -1) {
    if (typeof html !== 'string') {
      throw new TypeError('Expected html to be type of string, '
        + 'got type of ' + typeof html + ' instead.');
    }

    eof = isNaN(parseInt(eof)) ? html.indexOf('</head>') : eof;
    if (eof !== -1) html = html.slice(0, eof);

    const re = /<link[\S\s]+?\/?(?:link)?>/gi;

    let match, link = null;
    this.on('opensearch-link', element => link = element);

    while ((match = re.exec(html)) !== null) this.write(match[0]);

    return link;
  }
  apply(parser, options) {
    parser.getOpenSearchLink = this.getOpenSearchLink;
    parser.getOpenSearchDesc = this.getOpenSearchDesc;

    const { ultron } = parser;

    ultron.on('closetag', name => {
      if (name === 'head') ultron.remove();
    });

    ultron.on('opentag', (name, attribs) => {
      if (name === 'link') {
        const { rel, type, href, title } = attribs;

        if (!type || !href || !rel || !/^search$/i.test(rel)
            || !/^application\/opensearchdescription\+xml$/i.test(type)) {
          return;
        }

        const link = { href, title: title || '' };

        ultron.remove();
        parser.collect('opensearch-link', link);

        parser.getOpenSearchDesc(link.href, link.title);
      }
    });
  }
  getOpenSearchDesc(uri, title = '') {
    this.performRequest({ uri }, (error, response, body) => {
      if (error) {
        this.emit('error', error);
        return;
      }

      this.isolate(ultron => {
        let form, isDesc = false;
        ultron.on('opentag', (name, attribs) => {
          if (name === 'opensearchdescription') {
            isDesc = true;

            return;
          }

          if (isDesc) {
            if (name === 'shortname' && title) {
              ultron.once('text', text => {
                if (title.toLowerCase() !== text.toLowerCase()) {
                  isDesc = false;
                  form = undefined;
                }
              });

              return;
            }

            if (name === 'url') {
              if (/^text\/html$/i.test(attribs.type) && attribs.template) {
                attribs.action = attribs.template;

                form = new OpenSearchForm(attribs);
                this.collect('search-form', form);
              }

              return;
            }

            if (form !== undefined && name === 'param') {
              if (attribs.name && attribs.value) {
                form.data[attribs.name] = attribs.value;
              }
            }
          }
        });

        ultron.on('closetag', name => {
          if (name === 'opensearchdescription') ultron.remove();
          else if (name === 'url') form = undefined;
        });

        this.write(body);
      });
    });
  }
}

module.exports = { OpenSearchParser };
