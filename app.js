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

app.get('/', (req, res) => {
  return handleSortRequest(req, res, true, false);
});

app.get('/compared-sort', (req, res) => {
  return handleSortRequest(req, res, true, true);
});

app.get('/sortedAgenda', async (req, res) => {
  const sessionId = req.query.sessionId;
  const currentAgendaID = req.query.selectedAgenda;
  const agendaitemsOfSelectedAgenda = await repository.getAllAgendaItemsFromAgenda(currentAgendaID);

  const agendaitems = await repository.getAllAgendaitemsOfTheSessionWithAgendaName(sessionId);

  const changedAgendaItems = await setAllMappedPropertiesAndReturnSortedAgendaitems(
    agendaitems,
    agendaitemsOfSelectedAgenda,
    currentAgendaID
  );

  const combinedAgendas = await reduceAgendaitemsToUniqueAgendas(changedAgendaItems);
  const combinedAgendasWithAgendaitems = await getGroupedAgendaitems(combinedAgendas);

  res.send(combinedAgendasWithAgendaitems);
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

const reduceAgendaitemsPerTitle = (agendaitems) => {
  return agendaitems.reduce((agendaItems, agendaitem) => {
    agendaItems[agendaitem.groupTitle] = agendaItems[agendaitem.groupTitle] || {
      agendaitems: [],
      foundPriority: 2147111111,
      mandatees: agendaitem.mandatees,
    };
    agendaItems[agendaitem.groupTitle].agendaitems.push(agendaitem);
    agendaItems[agendaitem.groupTitle].foundPriority = Math.min(
      agendaItems[agendaitem.groupTitle].foundPriority,
      agendaitem.groupPriority
    );

    return agendaItems;
  }, {});
};

const setAllMappedPropertiesAndReturnSortedAgendaitems = (
  agendaitems,
  agendaitemsOfSelectedAgenda,
  currentAgendaID
) => {
  const mandatees = reduceMandateesToUniqueSubcases(agendaitems);

  return agendaitems.map((agendaitem) => {
    const uniqueMandatees = getUniqueMandatees(mandatees[agendaitem.subcaseId].mandatees);
    setGroupTitlesAndPriorityOfMandatees(uniqueMandatees, agendaitem);

    const foundAgendaItem = agendaitemsOfSelectedAgenda.find(
      (agendaitemToCheck) => agendaitemToCheck.subcaseId === agendaitem.subcaseId
    );
    agendaitem['selectedAgendaId'] = currentAgendaID;

    if (foundAgendaItem) {
      agendaitem['id'] = foundAgendaItem.id;
    }
    agendaitem['foundPrio'] = agendaitem.agendaitemPrio;

    return agendaitem;
  });
};

const getGroupedAgendaitems = (combinedAgendas) => {
  return Object.entries(combinedAgendas)
    .map((itemArray) => {
      if (itemArray[1].items.length > 0) {
        let obj = {
          agendaName: itemArray[0],
          agendaId: itemArray[1].agendaId,
          groups: createAgendaitemGroups(itemArray),
        };

        return obj;
      }
    })
    .filter((item) => item)
    .sort((a, b) => {
      if (a.agendaName < b.agendaName) return -1;
      if (a.agendaName > b.agendaName) return 1;
      return 0;
    });
};

const getUniqueMandatees = (mandatees) => {
  let uniqueMandatees = [];
  mandatees.map((mandatee) => {
    const foundMandatee = uniqueMandatees.find(
      (mandateeToCheck) => mandatee.title === mandateeToCheck.title
    );
    if (!foundMandatee) {
      uniqueMandatees.push(mandatee);
    }
  });
  return uniqueMandatees.sort((a, b) => parseInt(a.priority) - parseInt(b.priority));
};

const reduceMandateesToUniqueSubcases = (agendaitems) => {
  return agendaitems.reduce((agendaItems, agendaitem) => {
    agendaItems[agendaitem.subcaseId] = agendaItems[agendaitem.subcaseId] || {
      mandatees: [],
    };

    agendaItems[agendaitem.subcaseId].mandatees.push({
      title: agendaitem.title,
      priority: agendaitem.priority,
    });
    return agendaItems;
  }, {});
};

const reduceAgendaitemsToUniqueAgendas = (agendaitems) => {
  const subcaseIdsParsed = [];
  return agendaitems.reduce((agendaItems, agendaitem) => {
    agendaItems[agendaitem.agendaName] = agendaItems[agendaitem.agendaName] || {
      items: [],
      agendaId: agendaitem.agendaId,
    };
    if (!subcaseIdsParsed.includes(agendaitem.subcase)) {
      subcaseIdsParsed.push(agendaitem.subcase);
      agendaItems[agendaitem.agendaName].items.push(agendaitem);
    }

    return agendaItems;
  }, {});
};

const createAgendaitemGroups = (itemArray) => {
  const reducedAgendaItemsByTitle = reduceAgendaitemsPerTitle(itemArray[1].items);
  return Object.entries(reducedAgendaItemsByTitle)
    .map((entry) => {
      return {
        title: entry[0],
        priority: entry[1].foundPriority,
        mandatees: entry[1].mandatees,
        agendaitems: entry[1].agendaitems.sort(
          (a, b) => parseInt(a.agendaitemPrio) > parseInt(b.agendaitemPrio)
        ),
      };
    })
    .sort((a, b) => a.priority - b.priority);
};

const setGroupTitlesAndPriorityOfMandatees = (uniqueMandatees, agendaitem) => {
  agendaitem['mandatees'] = uniqueMandatees;
  const titles = uniqueMandatees.map((item) => item.title);
  agendaitem['groupTitle'] = titles.join(', ');
  const priorities = uniqueMandatees.map((item) => parseInt(item.priority));
  let minPriority = Math.min(...priorities);
  // create a priority based on the multiple priorities in the mandatee list
  if (priorities.length > 1) {
    priorities.map((priority) => {
      minPriority += priority / 1000;
    });
    agendaitem['groupPriority'] = minPriority;
  } else {
    agendaitem['groupPriority'] = minPriority;
  }
};
