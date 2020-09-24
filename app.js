import { app } from 'mu';
import bodyParser from 'body-parser';

import * as agendaCompare from './repository/compare-agenda';

const debug = process.env.DEBUG_LOGGING || false;

app.use(bodyParser.json({ type: 'application/*+json' }));

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
