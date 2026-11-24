// Shows a problem's given machine (diagram or table) or grammar (course form). Prerender-safe.
import type { Grammar, Machine } from '../../engine/types';
import { grammarTexParts } from '../../engine/latex';
import { machineToDoc } from '../../store/machineDoc';
import { Diagram } from '../machine/Diagram';
import StaticTable from '../machine/StaticTable';
import { Tex } from '../Tex';
import { isMachine } from '../../problems/types';

export function GrammarForm({ g }: { g: Grammar }) {
  const t = grammarTexParts(g);
  return (
    <div className="course-form">
      <Tex display>{t.P}</Tex>
      <Tex display>{`${t.T},\\quad S \\text{ is the start symbol}`}</Tex>
    </div>
  );
}

export default function GivenView({ given, asTable }: { given: Machine | Grammar; asTable?: boolean }) {
  if (isMachine(given)) {
    if (asTable) return <StaticTable m={given} caption="Given state table" />;
    return (
      <div className="diagram-frame">
        <Diagram doc={machineToDoc(given)} title="Given machine" maxHeight={340} />
      </div>
    );
  }
  return <GrammarForm g={given as Grammar} />;
}
