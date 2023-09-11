export function If(props: { value: any; children: React.ReactNode }): React.ReactElement | null {
   if (props.value) return <>{props.children}</>
   return null
}
