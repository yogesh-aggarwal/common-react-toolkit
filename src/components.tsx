import * as React from "react"

export function If(props: {
	value: any
	children: React.ReactNode
}): React.ReactNode {
	return <>{props.value && props.children}</>
}
