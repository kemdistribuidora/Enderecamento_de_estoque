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
      className="input w-full"
    />
  );
}
