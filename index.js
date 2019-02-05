const { SearchFormParser } = require('./lib/forms');
const { SiteActionParser } = require('./lib/site-actions');
const { OpenSearchParser } = require('./lib/opensearch');

module.exports = {
  getForms,
  SiteActionParser,
  SearchFormParser,
  OpenSearchParser
};

async function getForms(html, options) {
  const parser = new SearchFormParser({
    decodeEntities: true,
    ...options
  });

  parser.on('error', console.error);

  parser.chain(SiteActionParser);
  parser.chain(OpenSearchParser);

  parser.write(html);

  await parser.requests();

  return parser.sortForms();
}

