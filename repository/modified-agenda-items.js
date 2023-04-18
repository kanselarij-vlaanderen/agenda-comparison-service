import { query, sparqlEscapeUri, sparqlEscapeString } from 'mu';
import * as util from '../util/index';

async function queryModifiedgendaItemsForAgenda (currentAgendaId, comparedAgendaId, predicates) {
  /**
   * @argument predicates: predicates of the agenda-item on which we base the comparison
   */
  const agendaItemClause = `
    ?currentAgenda a besluitvorming:Agenda ;
    mu:uuid ${sparqlEscapeString(currentAgendaId)} ;
    besluitvorming:isAgendaVoor ?meeting ;
    dct:hasPart ?currentAgendaItem .
    ?comparedAgenda a besluitvorming:Agenda ;
    mu:uuid ${sparqlEscapeString(comparedAgendaId)} ;
    besluitvorming:isAgendaVoor ?meeting .
    ?currentAgendaItem mu:uuid ?agendaItemUuid .
    ?comparedAgenda dct:hasPart ?comparedAgendaItem .
    ?currentAgendaItem prov:wasRevisionOf ?comparedAgendaItem .
`;
  const filterClauses = predicates.map((predicate, index) => {
    const escPredicate = sparqlEscapeUri(predicate);
    return `
    {
        ?currentAgendaItem ${escPredicate} ?currentObject${index} .
        FILTER NOT EXISTS { ?comparedAgendaItem ${escPredicate} ?currentObject${index} . }
    }
    UNION
    {
        ?comparedAgendaItem ${escPredicate} ?comparedObject${index} .
        FILTER NOT EXISTS { ?comparedAgendaItem ${escPredicate} ?comparedObject${index} . }
    } `;
  });
  const queryString = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX besluitvorming: <https://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT DISTINCT (?currentAgendaItem AS ?agendaItemUri) ?agendaItemUuid WHERE {
      ${agendaItemClause}
      ${filterClauses.join('\nUNION\n')}
}`;
  const data = await query(queryString);
  return util.parseSparqlResults(data);
}

export default queryModifiedgendaItemsForAgenda;
