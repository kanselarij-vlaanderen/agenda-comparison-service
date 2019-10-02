import mu from 'mu';
import { ok } from 'assert';

const app = mu.app;
const bodyParser = require('body-parser');
const repository = require('./repository');
const cors = require('cors');

app.use(bodyParser.json({ type: 'application/*+json' }));
app.use(cors());

app.post('/', (req, res) => {
  return handleSortRequest(req, res);
});

app.get('/compared-sort', (req, res) => {
  return handleSortRequest(req, res, true, true);
});

app.get('/agenda-with-changes', async (req, res) => {
  const currentAgendaID = req.query.selectedAgenda;
  const previousAgendaId = req.query.agendaToCompare;

  const currentAgendaitems = await repository.getAllAgendaItemsFromAgendaWithDocuments(
    currentAgendaID
  );
  const previousAgendaitems = await repository.getAllAgendaItemsFromAgendaWithDocuments(
    previousAgendaId
  );

  const reducedCurrentAgendaitems = await reduceDocumentsAndDocumentVersions(currentAgendaitems);
  const reducedPreviousAgendaitems = await reduceDocumentsAndDocumentVersions(previousAgendaitems);

  let addedDocuments = [];
  let addedAgendaitems = [];

  reducedCurrentAgendaitems.forEach((currentAgendaItem) => {
    if (!currentAgendaItem) return;
    const foundItem = reducedPreviousAgendaitems.find(
      (item) => item.subcaseId == currentAgendaItem.subcaseId
    );

    if (!foundItem) {
      addedAgendaitems.push(currentAgendaItem.id);
      return;
    }
    currentAgendaItem.documents.forEach((document) => {
      if (!foundItem.documents.includes(document)) {
        addedDocuments.push(document);
      }
    });
  });
  res.send({
    currentAgendaID,
    previousAgendaId,
    addedDocuments,
    addedAgendaitems,
  });
});

const handleSortRequest = async (req, res, queryOnly, withoutFilter) => {
  let agendaId = req.query.agendaId;
  try {
    let agendaItems = [];
    if (withoutFilter) {
      agendaItems = await repository.getAgendaPrioritiesWithoutFilter(agendaId);
    } else {
      agendaItems = await repository.getAgendaPriorities(agendaId);
    }
    const previousPrio = await repository.getLastPriorityOfAgendaitemInAgenda(agendaId);
    const prioritizedAgendaItems = await sortAgendaItemsByMandates(
      agendaItems,
      previousPrio[0].maxPrio || 0
    );

    if (!queryOnly) {
      await repository.updateAgendaItemPriority(prioritizedAgendaItems);
    }

    res.send({
      status: ok,
      statusCode: 200,
      body: { items: prioritizedAgendaItems },
    });
  } catch (error) {
    console.error(error);
    res.send({ status: ok, statusCode: 500, body: { error } });
  }
};

const sortAgendaItemsByMandates = async (agendaItems, previousPrio) => {
  agendaItems.sort((a, b) => {
    let priorityDiff = a.mandatePriority - b.mandatePriority;
    if (priorityDiff == 0) {
      return a.mandateeCount - b.mandateeCount;
    } else {
      return priorityDiff;
    }
  });
  for (let i = 0; i < agendaItems.length; i++) {
    agendaItems[i].priority = i + 1 + parseInt(previousPrio);
  }
  return agendaItems;
};

const reduceDocumentsAndDocumentVersions = (agendaitems) => {
  return agendaitems.reduce((agendaItems, agendaitem) => {
    const foundItem = agendaItems.find((item) => item.id == agendaitem.id);
    if (!foundItem) {
      agendaitem.allDocumentVersions = [];
      agendaitem.documents = [];
      if (agendaitem.documentVersions) {
        agendaitem.allDocumentVersions.push(agendaitem.documentVersions);
      }
      if (agendaitem.document) {
        agendaitem.documents.push(agendaitem.document);
      }
      agendaItems.push(agendaitem);
    } else {
      const foundIndex = agendaItems.findIndex((item) => item.id == foundItem.id);

      if (agendaitem.documentVersions) {
        agendaItems[foundIndex].allDocumentVersions.push(agendaitem.documentVersions);
      }
      if (agendaitem.document) {
        agendaItems[foundIndex].documents.push(agendaitem.document);
      }
    }

    return agendaItems;
  }, []);
};