---
layout: default
---

Detects:
* Sitelinks Searchbox
* OpenSearch
* Forms

The detection methods are very robust and should work on 99% of sites that are searchable.
All result types are abstracted to forms.
Forms are ordered by probability of being a preferred search method.
The default confidence threshold is set to 20.
Forms with negative confidence are not likely to be search forms.

The code, although not very well commented, is well structured and will serve as it's own documentation for now.

Feel free to send PR's and open issues!
