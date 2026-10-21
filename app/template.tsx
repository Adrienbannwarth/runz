/** Remonté à chaque navigation : le contenu apparaît en fondu. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
