// Semantics Extractor API.

/// <reference path='base.ts' />
/// <reference path='repoMan.ts' />
/// <reference path='downloader.ts' />

// (Note: this is a function type declaration, not a class)
//
// Extracts metadata from raw response, using the given meta-metadata.
//
// @param repoMan
//   A RepoMan is used to resolve mmd types for linked objects.
interface Extractor
{
  (resp: Response, mmd: MetaMetadata, repoMan: RepoMan): Metadata;
}

// Default implementation.
var extract: Extractor = function(resp: Response,
                                  mmd: MetaMetadata,
                                  repoMan: RepoMan): Metadata {
  var metadata = { meta_metadata_name: mmd.name };
  // do extraction ...
  return metadata;
}

