# Tool catalog

Generated from the registered schemas with `npm run docs:tools`. Do not edit manually.

82 tools (31 write/workflow tools). Write tools are absent when ENABLE_WRITES=false.

## get_libraries

List your personal library and accessible group libraries.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_key_permissions

Inspect Zotero key permissions without returning the key.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

## search_libraries

Search up to 10 explicitly selected personal/group libraries. Each library reports its own results or error; no implicit cross-library selection.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "libraries": {
      "minItems": 1,
      "maxItems": 10,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "user",
              "group"
            ]
          },
          "id": {
            "type": "string",
            "pattern": "^[1-9]\\d*$"
          }
        },
        "required": [
          "type",
          "id"
        ],
        "additionalProperties": false
      }
    },
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "libraries",
    "query",
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## search_library

Search online titles, creators, years, tags, item types, or synced full text. Includes pagination metadata.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "q": {
      "type": "string",
      "maxLength": 1000
    },
    "qmode": {
      "type": "string",
      "enum": [
        "titleCreatorYear",
        "everything"
      ]
    },
    "tags": {
      "description": "Repeated tags use AND; use || within a tag for OR and a leading - for NOT.",
      "maxItems": 30,
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 255
      }
    },
    "itemType": {
      "type": "string",
      "maxLength": 200
    },
    "since": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "sort": {
      "type": "string",
      "enum": [
        "dateAdded",
        "dateModified",
        "title",
        "creator",
        "itemType",
        "date",
        "publicationTitle"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "asc",
        "desc"
      ]
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_recent

Get recently added online items.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_item_details

Get an item including editable metadata and version.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## get_items_batch

Fetch up to 50 items by their keys; compare returned keys for inaccessible or missing items.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "itemKeys"
  ],
  "additionalProperties": false
}
```

## get_item_children

List child attachments, notes and annotations with pagination.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "itemKey",
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_item_abstract

Read the stored abstract without retrieving attachments.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## get_trash

List items in the online trash.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_publications

List My Publications from your personal library.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_collections

List collections; use topOnly for root collections.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "topOnly": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "start",
    "limit",
    "topOnly"
  ],
  "additionalProperties": false
}
```

## get_collection_details

Get a collection and its current version.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "collectionKey"
  ],
  "additionalProperties": false
}
```

## get_collection_items

List items in a collection.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "q": {
      "type": "string",
      "maxLength": 1000
    },
    "qmode": {
      "type": "string",
      "enum": [
        "titleCreatorYear",
        "everything"
      ]
    },
    "tags": {
      "description": "Repeated tags use AND; use || within a tag for OR and a leading - for NOT.",
      "maxItems": 30,
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 255
      }
    },
    "itemType": {
      "type": "string",
      "maxLength": 200
    },
    "since": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "sort": {
      "type": "string",
      "enum": [
        "dateAdded",
        "dateModified",
        "title",
        "creator",
        "itemType",
        "date",
        "publicationTitle"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "asc",
        "desc"
      ]
    },
    "topOnly": {
      "default": false,
      "type": "boolean"
    }
  },
  "required": [
    "collectionKey",
    "start",
    "limit",
    "topOnly"
  ],
  "additionalProperties": false
}
```

## get_subcollections

List direct child collections.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "collectionKey",
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## search_collections

Find collections by case-insensitive name within a bounded scan; reports incomplete scans.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    }
  },
  "required": [
    "maxItems",
    "query"
  ],
  "additionalProperties": false
}
```

## get_collection_tree

Build collection hierarchy from a bounded remote scan; missing parents remain visible.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    }
  },
  "required": [
    "maxItems"
  ],
  "additionalProperties": false
}
```

## get_tags

List library or collection tags.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "q": {
      "type": "string",
      "maxLength": 255
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_item_tags

List tags assigned to one item.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## get_saved_searches

List saved search definitions. Zotero Web API does not execute saved searches.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## get_saved_search

Read a saved search definition.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "searchKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "searchKey"
  ],
  "additionalProperties": false
}
```

## get_item_types

List official Zotero item types.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

## get_item_fields

List valid fields for an item type.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "itemType": {
      "type": "string",
      "pattern": "^[a-zA-Z]+$"
    }
  },
  "required": [
    "itemType"
  ],
  "additionalProperties": false
}
```

## get_creator_types

List valid creator roles for an item type.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "itemType": {
      "type": "string",
      "pattern": "^[a-zA-Z]+$"
    }
  },
  "required": [
    "itemType"
  ],
  "additionalProperties": false
}
```

## get_item_template

Get an official editable item template before creation.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "itemType": {
      "type": "string",
      "pattern": "^[a-zA-Z]+$"
    },
    "linkMode": {
      "type": "string",
      "enum": [
        "imported_file",
        "imported_url",
        "linked_url"
      ]
    },
    "annotationType": {
      "type": "string",
      "enum": [
        "highlight",
        "underline",
        "note",
        "image",
        "ink",
        "text"
      ]
    }
  },
  "required": [
    "itemType"
  ],
  "additionalProperties": false
}
```

## get_sync_versions

Get remote object versions since a library version.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "since": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "kind": {
      "type": "string",
      "enum": [
        "items",
        "collections",
        "searches"
      ]
    }
  },
  "required": [
    "since",
    "kind"
  ],
  "additionalProperties": false
}
```

## get_deleted

Get deletion log since a library version.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "since": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "since"
  ],
  "additionalProperties": false
}
```

## get_fulltext_versions

List attachments with synced full-text changes since a version.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "since": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "since"
  ],
  "additionalProperties": false
}
```

## get_item_fulltext

Read synced full text of an attachment with explicit character paging. 404 means missing or unsynced content.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "offset": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "maxChars": {
      "default": 20000,
      "type": "integer",
      "minimum": 100,
      "maximum": 100000
    }
  },
  "required": [
    "itemKey",
    "offset",
    "maxChars"
  ],
  "additionalProperties": false
}
```

## search_fulltext

Search Zotero synced full text using its everything search mode.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    }
  },
  "required": [
    "start",
    "limit",
    "query"
  ],
  "additionalProperties": false
}
```

## get_content

Get abstract, notes and synced attachment text. Mode bounds output; each missing source is reported.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "mode": {
      "default": "standard",
      "type": "string",
      "enum": [
        "minimal",
        "preview",
        "standard",
        "complete"
      ]
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    }
  },
  "required": [
    "itemKey",
    "mode",
    "maxItems"
  ],
  "additionalProperties": false
}
```

## get_notes

List notes; query matches note HTML/text within the scanned page set.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "query": {
      "type": "string"
    }
  },
  "required": [
    "maxItems"
  ],
  "additionalProperties": false
}
```

## get_annotations

List synced Zotero annotations under one attachment.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "start": {
      "default": 0,
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "limit": {
      "default": 25,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "itemKey",
    "start",
    "limit"
  ],
  "additionalProperties": false
}
```

## search_annotations

Filter synced annotations by text, comment, color and tags within a bounded scan.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "query": {
      "type": "string"
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "tag": {
      "type": "string"
    }
  },
  "required": [
    "maxItems"
  ],
  "additionalProperties": false
}
```

## synthesize_annotations

Group synced annotation excerpts and comments by attachment for a literature digest. No AI-generated claims.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    }
  },
  "required": [
    "maxItems"
  ],
  "additionalProperties": false
}
```

## export_items

Export up to 50 selected items as BibTeX, BibLaTeX, RIS, CSL JSON, CSV or other official formats.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "format": {
      "type": "string",
      "enum": [
        "bibtex",
        "biblatex",
        "ris",
        "csljson",
        "csv",
        "mods",
        "tei",
        "rdf_zotero",
        "wikipedia"
      ]
    }
  },
  "required": [
    "itemKeys",
    "format"
  ],
  "additionalProperties": false
}
```

## get_bibliography

Generate a formatted bibliography using an official CSL style id.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "style": {
      "default": "apa",
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "locale": {
      "default": "en-US",
      "type": "string",
      "pattern": "^[a-z]{2}-[A-Z]{2}$"
    }
  },
  "required": [
    "itemKeys",
    "style",
    "locale"
  ],
  "additionalProperties": false
}
```

## get_citations

Get formatted in-text citations for selected items.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "style": {
      "default": "apa",
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "locale": {
      "default": "en-US",
      "type": "string"
    }
  },
  "required": [
    "itemKeys",
    "style",
    "locale"
  ],
  "additionalProperties": false
}
```

## download_attachment

Download a synced Zotero Storage attachment as base64. Size limited; no local filesystem or arbitrary URL access.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## create_item

Create a bibliographic item from Zotero editable JSON. Use get_item_template for supported fields. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "data": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "data"
  ],
  "additionalProperties": false
}
```

## create_items_batch

Create up to 50 items with partial-failure reporting. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "items": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    }
  },
  "required": [
    "items"
  ],
  "additionalProperties": false
}
```

## update_item

Patch selected metadata fields using the version from a preceding read. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "patch": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "itemKey",
    "version",
    "patch"
  ],
  "additionalProperties": false
}
```

## update_items_batch

Patch up to 50 items with explicit object versions; arrays replace their entire fields. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "updates": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "pattern": "^[A-Z0-9]{8}$"
          },
          "version": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "patch": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          }
        },
        "required": [
          "key",
          "version",
          "patch"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "updates"
  ],
  "additionalProperties": false
}
```

## trash_item

Move an item to trash with version protection. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "version"
  ],
  "additionalProperties": false
}
```

## restore_item

Restore a trashed item with version protection. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "version"
  ],
  "additionalProperties": false
}
```

## delete_item

PERMANENTLY delete an item. Preview includes its metadata; children may also be removed by Zotero. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "version"
  ],
  "additionalProperties": false
}
```

## create_note

Create a standalone note or child note using Zotero note HTML. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "parentItem": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "html": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100000
    },
    "tags": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "html",
    "tags"
  ],
  "additionalProperties": false
}
```

## update_note

Update an existing note, retaining other fields. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "html": {
      "type": "string",
      "maxLength": 100000
    }
  },
  "required": [
    "itemKey",
    "version",
    "html"
  ],
  "additionalProperties": false
}
```

## create_annotation

Create a synced annotation under an attachment. Supply valid Zotero position JSON and sort index from the document geometry. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "parentItem": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "type": {
      "type": "string",
      "enum": [
        "highlight",
        "underline",
        "note",
        "image",
        "ink",
        "text"
      ]
    },
    "text": {
      "default": "",
      "type": "string"
    },
    "comment": {
      "default": "",
      "type": "string"
    },
    "color": {
      "default": "#ffd400",
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "pageLabel": {
      "type": "string"
    },
    "sortIndex": {
      "type": "string",
      "maxLength": 100
    },
    "position": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "parentItem",
    "type",
    "text",
    "comment",
    "color",
    "pageLabel",
    "sortIndex",
    "position"
  ],
  "additionalProperties": false
}
```

## update_annotation

Update annotation text, comment, color or tags. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "text": {
      "type": "string"
    },
    "comment": {
      "type": "string"
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "itemKey",
    "version"
  ],
  "additionalProperties": false
}
```

## create_collection

Create a collection, optionally under a parent. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "parentCollection": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
}
```

## update_collection

Rename or reparent a collection; null moves it to the root. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "parentCollection": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[A-Z0-9]{8}$"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "collectionKey",
    "version"
  ],
  "additionalProperties": false
}
```

## delete_collection

Permanently delete a collection and its subcollections; this does not delete the member items. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "collectionKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "collectionKey",
    "version"
  ],
  "additionalProperties": false
}
```

## manage_item_collections

Add or remove collection memberships on up to 50 items, preserving other memberships. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "collectionKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "action": {
      "type": "string",
      "enum": [
        "add",
        "remove"
      ]
    }
  },
  "required": [
    "itemKeys",
    "collectionKeys",
    "action"
  ],
  "additionalProperties": false
}
```

## manage_tags

Add or remove tags on up to 50 items, preserving untouched tags and their types. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKeys": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    },
    "tags": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 255
      }
    },
    "action": {
      "type": "string",
      "enum": [
        "add",
        "remove"
      ]
    }
  },
  "required": [
    "itemKeys",
    "tags",
    "action"
  ],
  "additionalProperties": false
}
```

## set_item_parent

Set or clear the parent of a note or attachment; null makes it standalone. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "parentItem": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[A-Z0-9]{8}$"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "itemKey",
    "version",
    "parentItem"
  ],
  "additionalProperties": false
}
```

## get_item_related

Read explicit item relations.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## manage_relation

Add or remove a bidirectional dc:relation between two items in one library. Batch outcomes are reported per item. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "relatedItemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "action": {
      "type": "string",
      "enum": [
        "add",
        "remove"
      ]
    }
  },
  "required": [
    "itemKey",
    "relatedItemKey",
    "action"
  ],
  "additionalProperties": false
}
```

## create_saved_search

Create a saved search definition; conditions follow Zotero API syntax. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "conditions": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "condition": {
            "type": "string"
          },
          "operator": {
            "type": "string"
          },
          "value": {
            "type": "string"
          }
        },
        "required": [
          "condition",
          "operator",
          "value"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "name",
    "conditions"
  ],
  "additionalProperties": false
}
```

## update_saved_search

Update a saved search definition using versioned batch-write semantics. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "searchKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "conditions": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "condition": {
            "type": "string"
          },
          "operator": {
            "type": "string"
          },
          "value": {
            "type": "string"
          }
        },
        "required": [
          "condition",
          "operator",
          "value"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "searchKey",
    "version",
    "name",
    "conditions"
  ],
  "additionalProperties": false
}
```

## delete_saved_search

Delete one saved search definition with object and library version protection. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "searchKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "searchKey",
    "version"
  ],
  "additionalProperties": false
}
```

## create_attachment

Create an attachment record. Use upload_attachment next to upload bytes for imported_file; linked_url stores only a remote link. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "parentItem": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "filename": {
      "type": "string",
      "maxLength": 255
    },
    "contentType": {
      "default": "application/pdf",
      "type": "string",
      "maxLength": 100
    },
    "linkMode": {
      "default": "imported_file",
      "type": "string",
      "enum": [
        "imported_file",
        "linked_url"
      ]
    },
    "url": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": [
    "title",
    "contentType",
    "linkMode"
  ],
  "additionalProperties": false
}
```

## upload_attachment

Upload or replace bytes for an existing Zotero Storage attachment using authorization, storage upload, and registration. Base64 size is bounded. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "version": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "base64": {
      "type": "string",
      "minLength": 4
    },
    "filename": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "pattern": "^[^/\\\\\\x00-\\x1f]+$"
    },
    "mtime": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "version",
    "base64",
    "filename",
    "mtime"
  ],
  "additionalProperties": false
}
```

## set_fulltext

Upload extracted text to the online full-text index; this does not upload the source file. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "content": {
      "type": "string",
      "maxLength": 1000000
    },
    "indexedPages": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "totalPages": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "content"
  ],
  "additionalProperties": false
}
```

## execute_write

Execute a prepared plan ONLY after the user explicitly approves its preview. Consumes its tenant-bound token once, including on upstream failure.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "confirmationToken": {
      "type": "string",
      "minLength": 32,
      "maxLength": 128
    }
  },
  "required": [
    "confirmationToken"
  ],
  "additionalProperties": false
}
```

## advanced_search

Apply AND/OR field filters to a bounded scan of remote items. Reports scan truncation; does not claim whole-library results when bounded.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "match": {
      "default": "all",
      "type": "string",
      "enum": [
        "all",
        "any"
      ]
    },
    "filters": {
      "minItems": 1,
      "maxItems": 20,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string",
            "enum": [
              "title",
              "creator",
              "date",
              "DOI",
              "ISBN",
              "abstractNote",
              "extra",
              "tag",
              "itemType"
            ]
          },
          "operator": {
            "type": "string",
            "enum": [
              "contains",
              "equals",
              "startsWith",
              "notContains"
            ]
          },
          "value": {
            "type": "string",
            "minLength": 1,
            "maxLength": 10000
          }
        },
        "required": [
          "field",
          "operator",
          "value"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "maxItems",
    "match",
    "filters"
  ],
  "additionalProperties": false
}
```

## find_duplicates

Identify candidate duplicates by normalized DOI or title. Does not merge; title matches require human review.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "by": {
      "default": "DOI",
      "type": "string",
      "enum": [
        "DOI",
        "title"
      ]
    }
  },
  "required": [
    "maxItems",
    "by"
  ],
  "additionalProperties": false
}
```

## get_library_stats

Compute item-type, year and tag counts for a bounded remote sample; includes total and coverage.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    }
  },
  "required": [
    "maxItems"
  ],
  "additionalProperties": false
}
```

## merge_duplicates

Consolidate two explicitly chosen same-type bibliographic items. Keep primary metadata, fill empty fields, union tags/collections/relations, move children, then trash the secondary. This is not the desktop native merge: incoming links from other items are not rewritten. Partial failures stop before trash. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "primaryKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "secondaryKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "primaryVersion": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "secondaryVersion": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "primaryKey",
    "secondaryKey",
    "primaryVersion",
    "secondaryVersion"
  ],
  "additionalProperties": false
}
```

## search_by_citation_key

Look up an explicitly stored Citation Key in Extra. Better BibTeX local generated keys are not remotely available.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 500,
      "type": "integer",
      "minimum": 1,
      "maximum": 5000
    },
    "citationKey": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    }
  },
  "required": [
    "maxItems",
    "citationKey"
  ],
  "additionalProperties": false
}
```

## add_by_doi

Resolve a DOI through Crossref and preview a Zotero item. Only the identifier is sent to Crossref. Does not download publisher PDFs. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "doi": {
      "type": "string",
      "minLength": 7,
      "maxLength": 300
    },
    "collections": {
      "default": [],
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "doi",
    "collections"
  ],
  "additionalProperties": false
}
```

## add_by_isbn

Resolve a book ISBN through Open Library and preview a Zotero book. Only the ISBN is sent externally. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "isbn": {
      "type": "string",
      "maxLength": 30
    },
    "collections": {
      "default": [],
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "isbn",
    "collections"
  ],
  "additionalProperties": false
}
```

## add_by_url

Create a webpage reference from a user-provided HTTP(S) URL and title. Does not scrape the URL or guess scholarly metadata. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "url": {
      "type": "string",
      "format": "uri"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "collections": {
      "default": [],
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "url",
    "title",
    "collections"
  ],
  "additionalProperties": false
}
```

## import_csl_json

Import up to 50 CSL JSON references. Supported types and mapped fields are documented; preview all converted metadata. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "items": {
      "minItems": 1,
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "collections": {
      "default": [],
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "items",
    "collections"
  ],
  "additionalProperties": false
}
```

## import_bibliography

Parse inline BibTeX or RIS without filesystem access or network resolution; preview converted CSL metadata before creating items. Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.

Mode: **write preview / execution**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "maxLength": 250000
    },
    "format": {
      "type": "string",
      "enum": [
        "bibtex",
        "ris"
      ]
    },
    "collections": {
      "default": [],
      "maxItems": 50,
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9]{8}$"
      }
    }
  },
  "required": [
    "text",
    "format",
    "collections"
  ],
  "additionalProperties": false
}
```

## read_pdf_pages

Extract text from up to 10 pages of a synced PDF in an isolated parser. Scanned pages may have no text; no OCR or image rendering.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "startPage": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    },
    "endPage": {
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "itemKey",
    "startPage",
    "endPage"
  ],
  "additionalProperties": false
}
```

## get_pdf_outline

Extract a synced PDF table of contents. Files without bookmarks return an empty outline.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    }
  },
  "required": [
    "itemKey"
  ],
  "additionalProperties": false
}
```

## build_semantic_index

Build an ephemeral, tenant-isolated semantic index of online titles and abstracts (max 500 items). Sends those texts to the configured embedding provider only with explicit consent.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "maxItems": {
      "default": 100,
      "type": "integer",
      "minimum": 1,
      "maximum": 500
    },
    "consentToExternalProcessing": {
      "type": "boolean",
      "const": true,
      "description": "User explicitly agreed to send titles, abstracts or search text to the operator-configured embedding provider."
    }
  },
  "required": [
    "maxItems",
    "consentToExternalProcessing"
  ],
  "additionalProperties": false
}
```

## semantic_status

Report semantic provider configuration and current library index coverage.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

## semantic_search

Rank the current online-library index with real embedding cosine similarity; requires a configured provider and fresh index.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 10000
    },
    "limit": {
      "default": 10,
      "type": "integer",
      "minimum": 1,
      "maximum": 50
    },
    "consentToExternalProcessing": {
      "type": "boolean",
      "const": true,
      "description": "User explicitly agreed to send titles, abstracts or search text to the operator-configured embedding provider."
    }
  },
  "required": [
    "query",
    "limit",
    "consentToExternalProcessing"
  ],
  "additionalProperties": false
}
```

## find_similar

Find semantically related online items using a source title and abstract.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    },
    "itemKey": {
      "type": "string",
      "pattern": "^[A-Z0-9]{8}$"
    },
    "limit": {
      "default": 10,
      "type": "integer",
      "minimum": 1,
      "maximum": 50
    },
    "consentToExternalProcessing": {
      "type": "boolean",
      "const": true,
      "description": "User explicitly agreed to send titles, abstracts or search text to the operator-configured embedding provider."
    }
  },
  "required": [
    "itemKey",
    "limit",
    "consentToExternalProcessing"
  ],
  "additionalProperties": false
}
```

## clear_semantic_index

Clear only your current library semantic index from server memory.

Mode: **read / research**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "library": {
      "description": "Defaults to your personal online library. Pass a group id explicitly for a group library.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "user",
            "group"
          ]
        },
        "id": {
          "type": "string",
          "pattern": "^[1-9]\\d*$"
        }
      },
      "required": [
        "type",
        "id"
      ],
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```
