// Base type definitions

interface MetaMetadata
{
  name: string;
}

interface MetaMetadataMap
{
  [name: string]: MetaMetadata; // map: name => mmd
}

interface Metadata
{
  // we now require this field for every metadata object
  meta_metadata_name: string;
}

interface Request
{
  method: string,
  params?: any,
  callbackId?: any
}

interface Response
{
  method: string,
  result?: any,
  error?: any,
  callbackId?: any
}

