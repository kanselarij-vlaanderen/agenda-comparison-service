import { query, sparqlEscapeString } from 'mu';
import * as util from '../util/index';

async function queryNewAgendaItemsForAgenda (currentAgendaId, comparedAgendaId) {
  const queryString = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT DISTINCT (?agendaItem AS ?agendaItemUri) ?agendaItemUuid WHERE {
    ?currentAgenda a besluitvorming:Agenda ;
        mu:uuid ${sparqlEscapeString(currentAgendaId)} ;
        besluitvorming:isAgendaVoor ?meeting ;
        dct:hasPart ?currentAgendaItem .
    ?comparedAgenda a besluitvorming:Agenda ;
        mu:uuid ${sparqlEscapeString(comparedAgendaId)} ;
        besluitvorming:isAgendaVoor ?meeting .
    ?currentAgendaItem mu:uuid ?agendaItemUuid .
    FILTER NOT EXISTS {
        ?comparedAgenda dct:hasPart ?comparedAgendaItem .
        ?currentAgendaItem prov:wasRevisionOf ?comparedAgendaItem .
    }
}`;
  const data = await query(queryString);
  return util.parseSparqlResults(data);
}

export default queryNewAgendaItemsForAgenda;
