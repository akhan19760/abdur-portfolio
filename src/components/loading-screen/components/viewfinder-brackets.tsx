export function ViewfinderBrackets() {
  return (
    <>
      <div className="absolute left-5 top-5 z-20 h-6 w-6 border-l border-t border-text/20" />
      <div className="absolute right-5 top-5 z-20 h-6 w-6 border-r border-t border-text/20" />
      <div className="absolute bottom-5 left-5 z-20 h-6 w-6 border-b border-l border-text/20" />
      <div className="absolute bottom-5 right-5 z-20 h-6 w-6 border-b border-r border-text/20" />
    </>
  )
}
