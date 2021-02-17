# agenda-sort-service

Microservice providing capabilities for comparing various agenda-related entities across different versions of a given agenda.

## Getting started
### Add the service to a stack
Add the following snippet to your `docker-compose.yml`:

```yml
document-versions:
  image: kanselarij/agenda-sort-service
```

## Reference
### API
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

In case of no changed documents a `404` status is returned.

#### GET /agenda-with-changes
TODO