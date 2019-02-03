const { Parser } = require('./lib/html-parser');

const { SiteActionParser } = require('./lib/site-actions');
const { SearchFormParser } = require('./lib/forms');
const { OpenSearchParser } = require('./lib/opensearch');

// const html = require('fs').readFileSync('./test.html', 'utf-8');
// getForms(html, { location: 'http://localhost:8000' }).then(console.log);

module.exports = {
  getForms,
  Parser,
  SiteActionParser,
  SearchFormParser,
  OpenSearchParser
};

async function getForms(html, options) {
  const parser = new Parser({
    decodeEntities: true,
    ...options
  });

  parser.on('error', console.error);

  parser.chain(SiteActionParser);
  parser.chain(SearchFormParser);
  parser.chain(OpenSearchParser);

  parser.write(html);

  await parser.requests();

  return parser.sortForms();
}

