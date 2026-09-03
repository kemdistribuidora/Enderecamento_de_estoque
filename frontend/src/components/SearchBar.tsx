import { useState } from 'react';

interface Props {
  onChange: (valor: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function SearchBar({ onChange, onFocus, onBlur }: Props) {
  const [valor, setValor] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novoValor = e.target.value;
    setValor(novoValor);
    onChange(novoValor);
  }

  return (
    <input
      type="text"
      value={valor}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder="Buscar por código ou nome do produto..."
      autoFocus
      className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    />
  );
}
