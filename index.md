---
layout: default
---

[![npm version](https://badge.fury.io/js/search-forms.svg)](https://badge.fury.io/js/search-forms) ![](https://img.shields.io/npm/dw/search-forms.svg?style=flat)

Detects:
* Sitelinks Searchbox
* OpenSearch
* Forms

```sh
npm i --save search-forms
```

The detection methods are very robust and should work on 99% of sites that are searchable.
All result types are abstracted to forms.
Forms are ordered by probability of being a preferred search method.
The default confidence threshold is set to 20.
Forms with negative confidence are not likely to be search forms.

###### RunKit Tips

***You can try it now by using the run button.***<br>
###### Try expanding the html response to render the results!

{% include runkit.html %}

Feel free to send PR's and open issues!
