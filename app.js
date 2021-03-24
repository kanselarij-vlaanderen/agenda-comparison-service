import { app } from 'mu';
import bodyParser from 'body-parser';

import * as agendaCompare from './repository/compare-agenda';
import queryNewAgendaItemsForAgenda from './repository/new-agenda-items';
import queryNewDocumentsForAgendaItem from './repository/new-agenda-item-documents';

const debug = process.env.DEBUG_LOGGING || false;

app.use(bodyParser.json({ type: 'application/*+json' }));

const JSONAPI_DOCUMENT_TYPE = 'pieces';
const JSONAPI_AGENDA_ITEM_TYPE = 'agendaitems';

app.get('/agendas/:current_agenda_id/compare/:compared_agenda_id/agenda-items', async (req, res) => {
  const currentAgendaId = req.params.current_agenda_id;
  const comparedAgendaId = req.params.compared_agenda_id;
  const agendaItems = await queryNewAgendaItemsForAgenda(currentAgendaId, comparedAgendaId);
  const data = agendaItems.map((agendaItem) => {
    return {
      type: JSONAPI_AGENDA_ITEM_TYPE,
      id: agendaItem.agendaItemUuid,
      attributes: {
        uri: agendaItem.agendaItemUri
      }
    };
  });
  return res.send({
    data
  });
});

app.get('/agendas/:current_agenda_id/compare/:compared_agenda_id/agenda-item/:agenda_item_id/documents', async (req, res) => {
  const currentAgendaId = req.params.current_agenda_id;
  const comparedAgendaId = req.params.compared_agenda_id;
  const agendaItemId = req.params.agenda_item_id;
  const documents = await queryNewDocumentsForAgendaItem(currentAgendaId, comparedAgendaId, agendaItemId);
  const data = documents.map((document) => {
    return {
      type: JSONAPI_DOCUMENT_TYPE,
      id: document.documentUuid,
      attributes: {
        uri: document.documentUri
      }
    };
  });
  return res.send({
    data
  });
});


app.get('/agenda-with-changes', async (req, res) => {
  const currentAgendaID = req.query.selectedAgenda;
  const previousAgendaId = req.query.agendaToCompare;

  const currentAgendaitems = await agendaCompare.getAllAgendaItemsFromAgendaWithDocuments(
    currentAgendaID
  );
  const previousAgendaitems = await agendaCompare.getAllAgendaItemsFromAgendaWithDocuments(
    previousAgendaId
  );

  const reducedCurrentAgendaitems = await agendaCompare.reduceDocumentsAndDocumentVersions(currentAgendaitems);
  const reducedPreviousAgendaitems = await agendaCompare.reduceDocumentsAndDocumentVersions(previousAgendaitems);

  let addedDocuments = [];
  let addedAgendaitems = [];

  reducedCurrentAgendaitems.forEach((currentAgendaItem) => {
    if (!currentAgendaItem) return;
    const previousItem = reducedPreviousAgendaitems.find(
      (item) => item.subcaseId == currentAgendaItem.subcaseId
    );
    if (debug) {
      console.debug(
`###### Comparing: 
  New: ${JSON.stringify(currentAgendaItem, null, 4)}
  Old: ${JSON.stringify(previousItem, null, 4)}`);
    }

    if (!previousItem) {
      addedAgendaitems.push(currentAgendaItem.id);
    }
    currentAgendaItem.documents.forEach((document) => {
      if (!previousItem || agendaCompare.isDocumentAdded(previousItem, document) || agendaCompare.isVersionAdded(previousItem, document)) {
        addedDocuments.push(document.id);
      }
    });
  });
  if (debug) {
    console.debug(
`###### Added: 
  Documents: ${JSON.stringify(addedDocuments, null, 4)}
  Agenda items: ${JSON.stringify(addedAgendaitems, null, 4)}`);
  }

  res.send({
    currentAgendaID,
    previousAgendaId,
    addedDocuments,
    addedAgendaitems,
  });
});
