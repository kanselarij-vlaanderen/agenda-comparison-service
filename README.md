# agenda-comparison-service

Microservice providing capabilities for comparing various agenda-related entities across different versions of a given agenda.

## Getting started
### Add the service to a stack
Add the following snippet to your `docker-compose.yml`:

```yml
document-versions:
  image: kanselarij/agenda-comparison-service
```

## Reference
### API
#### GET /agendas/:current_agenda_id/compare/:compared_agenda_id/agenda-items
Fetch all agenda-items that are *different* between the `current_agenda_id`- and `compared_agenda_id`-version of the agenda.

By default, "different" is interpreted as `changeset=new`. In other words: by default, without options, this endpoint will return all agenda-items that are new on the `current_agenda_id`-agenda compared to the `compared_agenda_id`-agenda.

Query parameters:
- `changeset`: `new` is the default. Only returns new items. `modified` returns items which already existed on the compared agenda, but have been modified with respect to the current agenda (see `scope`-param).
- `scope`: specify which JSONAPI-fields should be taken into account when determining if an item has been "modified".

Example response body

```json
{
  "data": [{
    "type": "agendaitems",
    "id": "49c53852-c108-43f6-8f14-936795684878"
  },
  {
    "type": "agendaitems",
    "id": "49c54702-c108-43f6-bbfb-933486741899"
  }]
}
```

In case no different agenda-items were found, an empty response will be returned:

```json
{
  "data": []
}
```

#### GET /agendas/:current_agenda_id/compare/:compared_agenda_id/agenda-item/:agenda_item_id/documents
Fetch all document that are new for an agenda-item compared to its predecessor on a previous version of the agenda.

Example response body

```json
{
  "data": [{
    "type": "pieces",
    "id": "49c54702-c108-43f6-8f14-936427271878"
  },
  {
    "type": "pieces",
    "id": "49c54702-c108-43f6-bbfb-936658741899"
  }]
}
```

#### GET /agenda-with-changes
Fetch all documents and agenda-items that have been added between 2 agendas

Example response body

```json
{
  "addedDocuments": [ "49c53852-c108-43f6-8f14-936795684878", "49c54702-c108-43f6-bbfb-933486741899" ],
  "addedAgendaitems": [ "49c53852-c108-43f6-8f14-936795684878", "49c54702-c108-43f6-bbfb-933486741899" ]
}
```