import { parsePostSort, type PostSortOrder } from './post-sort';
import './post-sort.css';

export function PostSort({ value, onChange }: { value: PostSortOrder; onChange: (value: PostSortOrder) => void }) {
  return <label className="post-sort"><span className="sr-only">글 정렬</span><select value={value} onChange={event => onChange(parsePostSort(event.target.value))}>
    <option value="newest">최신순</option>
    <option value="oldest">오래된순</option>
    <option value="title">제목순</option>
  </select></label>;
}
