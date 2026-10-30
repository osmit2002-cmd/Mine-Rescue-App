import { Link } from 'react-router-dom';
import { useData } from '../../data/DataContext';
import { ruleName } from '../rules';

/** Links to the rules behind an action ("Rule 24", "A Card 5"), when the rule book is loaded. */
export function RuleRefs({ ids }: { ids: string[] }) {
  const { rulesById } = useData();
  if (!ids.length) return null;
  return (
    <span className="rule-refs">
      {ids.map((id, i) => {
        const r = rulesById.get(id);
        return (
          <span key={id}>
            {i > 0 && ', '}
            {r ? (
              <Link to={`/rules/${encodeURIComponent(id)}`} title={r.text.slice(0, 160)}>
                {ruleName(id)}
              </Link>
            ) : (
              ruleName(id)
            )}
          </span>
        );
      })}
    </span>
  );
}
