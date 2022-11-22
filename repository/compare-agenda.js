import mu, { sparqlEscapeString } from 'mu';
import * as util from '../util/index';

const getAllAgendaItemsFromAgendaWithDocuments = async (agendaId) => {
  const query = `
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>

    SELECT ?subcaseId ?id ?documentVersions ?document WHERE {
      ?agenda a besluitvorming:Agenda ;
                mu:uuid ${sparqlEscapeString(agendaId)} .
      ?agenda   dct:hasPart ?agendaitem .
      ?agendaitem mu:uuid ?id .
      OPTIONAL {
        ?subcase  ^besluitvorming:vindtPlaatsTijdens / besluitvorming:genereertAgendapunt ?agendaitem ;
                    mu:uuid ?subcaseId .
      }
      OPTIONAL {
        ?agendaitem besluitvorming:geagendeerdStuk ?documentVersions .
        ?document   dossier:Collectie.bestaatUit ?documentVersions .
      }
    }`;
  const data = await mu.query(query);
  return util.parseSparqlResults(data);
};

const reduceDocumentsAndDocumentVersions = (agendaitems) => {
  return agendaitems.reduce((agendaItems, agendaitem) => {
    const foundItem = agendaItems.find((item) => item.id == agendaitem.id);
    if (!foundItem) {
      agendaitem.allDocumentVersions = [];
      agendaitem.documents = [];
      if (agendaitem.documentVersions && agendaitem.document) {
        agendaitem.allDocumentVersions.push(agendaitem.documentVersions);
        agendaitem.documents.push({
          id: agendaitem.document,
          documentVersions: [agendaitem.documentVersions]
        });
      }
      agendaItems.push(agendaitem);
    } else {
      const foundIndex = agendaItems.findIndex((item) => item.id == foundItem.id);
      if (agendaitem.documentVersions) {
        agendaItems[foundIndex].allDocumentVersions.push(agendaitem.documentVersions);
        const foundDocument = agendaItems[foundIndex].documents.find(document => document.id === agendaitem.document);
        if (foundDocument) {
          foundDocument.documentVersions.push(agendaitem.documentVersions);
        } else {
          agendaItems[foundIndex].documents.push({
            id: agendaitem.document,
            documentVersions: [agendaitem.documentVersions]
          });
        }
      }
    }
    return agendaItems;
  }, []);
};


const isDocumentAdded = (previousItem, document) => {
  return !previousItem.documents.find(previousDocument => previousDocument.id === document.id);
};

const isVersionAdded = (previousItem, document) => {
  const previousDocument = previousItem.documents.find(previousDocument => previousDocument.id === document.id);

  if (previousDocument) {
    for (let i = 0; i < document.documentVersions.length; i++) {
      const documentVersion = document.documentVersions[i];
      if (!previousDocument.documentVersions.includes(documentVersion)) {
        return true;
      }
    }
  }

  return false;
};

export {
  getAllAgendaItemsFromAgendaWithDocuments,
  reduceDocumentsAndDocumentVersions,
  isDocumentAdded,
  isVersionAdded
};
