const { SearchFormParser } = require('./lib/forms');
const { SiteActionParser } = require('./lib/site-actions');
const { OpenSearchParser } = require('./lib/opensearch');

// const html = require('fs').readFileSync('./test.html', 'utf-8');
/*
require('request')({ uri: process.argv[2] }, (error, response, html) => {
  if (error) {
    console.error(error);
    return;
  }

  getForms(html, { location: process.argv[2] }).then(console.log);
});
*/

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

