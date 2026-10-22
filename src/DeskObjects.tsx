import { useEffect, useState } from 'react';
import './desk.css';
import { StartLights } from './StartLights';
import { NowNote } from './NowNote';
import type { Navigate } from './navigation';
import { useDeskLayout } from './useDeskLayout';

const pad = (value: number) => String(value).padStart(2, '0');
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function DeskObjects({ arrangement, go }: { arrangement: number; go: Navigate }) {
  const { ref, layout } = useDeskLayout(arrangement);
  const position = (index: number) => layout ? { left: layout.items[index].x, top: layout.items[index].y } : undefined;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setNow(new Date());
      timer = setTimeout(update, 1_000 - Date.now() % 1_000);
    };
    const resume = () => { if (!document.hidden) update(); };
    update();
    document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);

  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDay + days) / 7);
  const datePrefix = `${year}-${pad(month + 1)}`;
  const hourAngle = (now.getHours() % 12) * 30 + now.getMinutes() / 2 + now.getSeconds() / 120;
  const minuteAngle = now.getMinutes() * 6 + now.getSeconds() / 10;
  const secondAngle = now.getSeconds() * 6;

  return <aside ref={ref} className="desk-objects" data-arrangement={arrangement} data-layout={layout ? 'free' : 'stack'} aria-label="책상 위 소품">
    <div className="desk-item desk-item-note" style={position(0)}><NowNote go={go}/></div>
    <div className="desk-item desk-item-game" style={position(1)}><StartLights/></div>
    <div className="desk-item desk-item-clock" style={position(2)}>
    <div className="desk-clock" role="group" aria-label="현재 시간">
      <div className="desk-clock-face">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <line key={index} x1="80" y1="13" x2="80" y2={index % 3 === 0 ? 23 : 19} transform={`rotate(${index * 30} 80 80)`} className={index % 3 === 0 ? 'clock-hour-mark' : 'clock-minute-mark'}/>)}
          <line x1="80" y1="85" x2="80" y2="44" transform={`rotate(${hourAngle} 80 80)`} className="clock-hour-hand"/>
          <line x1="80" y1="88" x2="80" y2="27" transform={`rotate(${minuteAngle} 80 80)`} className="clock-minute-hand"/>
          <line x1="80" y1="94" x2="80" y2="18" transform={`rotate(${secondAngle} 80 80)`} className="clock-second-hand"/>
          <circle cx="80" cy="80" r="5" className="clock-pin"/>
        </svg>
      </div>
      <time className="desk-clock-time" dateTime={now.toISOString()} aria-label={`${now.getHours()}시 ${now.getMinutes()}분`}>{pad(now.getHours())}:{pad(now.getMinutes())}</time>
    </div>
    </div>
    <div className="desk-item desk-item-calendar" style={position(3)}>
    <div className="desk-calendar">
      <div className="desk-calendar-rings" aria-hidden="true"><i/><i/></div>
      <table aria-label={`${year}년 ${month + 1}월 달력`}>
        <caption><span>{year}</span><strong>{pad(month + 1)}</strong></caption>
        <thead><tr>{weekdays.map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: weeks }, (_, week) => <tr key={week}>{weekdays.map((_, day) => {
          const date = week * 7 + day - firstDay + 1;
          return <td key={day}>{date > 0 && date <= days && <time dateTime={`${datePrefix}-${pad(date)}`} aria-current={date === now.getDate() ? 'date' : undefined}>{date}</time>}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    </div>
  </aside>;
}
