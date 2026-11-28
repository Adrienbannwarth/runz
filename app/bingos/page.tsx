import { redirect } from 'next/navigation';

/** Faute de frappe courante : /bingos → /bingoz (qui reste privé). */
export default function Bingos() {
  redirect('/bingoz');
}
