import { query, sparqlEscapeString } from 'mu';
import * as util from '../util/index';

async function queryNewDocumentsForAgendaItem (currentAgendaId, comparedAgendaId, agendaItemId) {
  const queryString = `
PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT DISTINCT (?document AS ?documentUri) ?documentUuid WHERE {
    ?currentAgenda a besluitvorming:Agenda ;
        mu:uuid ${sparqlEscapeString(currentAgendaId)} ;
        besluitvorming:isAgendaVoor ?meeting ;
        dct:hasPart ?currentAgendaItem .
    ?comparedAgenda a besluitvorming:Agenda ;
        mu:uuid ${sparqlEscapeString(comparedAgendaId)} ;
        besluitvorming:isAgendaVoor ?meeting .
    ?currentAgendaItem mu:uuid ${sparqlEscapeString(agendaItemId)} ;
        besluitvorming:geagendeerdStuk ?document .
    ?document a dossier:Stuk ;
        mu:uuid ?documentUuid .
    OPTIONAL {
        ?comparedAgenda dct:hasPart ?comparedAgendaItem .
        ?currentAgendaItem prov:wasRevisionOf ?comparedAgendaItem .
    }
    FILTER NOT EXISTS {
        ?comparedAgendaItem besluitvorming:geagendeerdStuk ?document .
    }
}`;
  const data = await query(queryString);
  return util.parseSparqlResults(data);
}

export default queryNewDocumentsForAgendaItem;
