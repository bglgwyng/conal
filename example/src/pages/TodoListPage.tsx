import { Button, Checkbox, Group, Stack, TextInput, Title } from "@mantine/core";
import { useState } from "../hooks/useState";

interface Todo {
	id: number;
	text: string;
	completed: boolean;
}

let nextId = 1;

export function TodoListPage() {
	const [inputValue, setInputValue] = useState("");
	const [todos, setTodos] = useState<Todo[]>([]);
	
	const handleAddTodo = () => {
		const text = inputValue.trim();
		if (text) {
			setTodos([...todos, {
				id: nextId++,
				text,
				completed: false
			}]);
			setInputValue("");
		}
	};
	
	const handleToggleTodo = (id: number) => {
		setTodos(todos.map(todo =>
			todo.id === id ? { ...todo, completed: !todo.completed } : todo
		));
	};
	
	const handleDeleteTodo = (id: number) => {
		setTodos(todos.filter(todo => todo.id !== id));
	};
	
	const activeCount = todos.filter(todo => !todo.completed).length;
	const completedCount = todos.filter(todo => todo.completed).length;
	
	return (
		<Stack>
			<Title order={2}>Todo List Example</Title>
			
			<Group>
				<TextInput
					placeholder="Add a new todo..."
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
					style={{ flex: 1 }}
				/>
				<Button onClick={handleAddTodo}>Add</Button>
			</Group>
			
			<Stack gap="xs">
				{todos.map(todo => (
					<Group key={todo.id}>
						<Checkbox
							checked={todo.completed}
							onChange={() => handleToggleTodo(todo.id)}
						/>
						<span
							style={{
								textDecoration: todo.completed ? "line-through" : "none",
								flex: 1,
							}}
						>
							{todo.text}
						</span>
						<Button
							size="xs"
							color="red"
							onClick={() => handleDeleteTodo(todo.id)}
						>
							Delete
						</Button>
					</Group>
				))}
			</Stack>
			
			<Group>
				<span>Active: {activeCount}</span>
				<span>Completed: {completedCount}</span>
				<span>Total: {todos.length}</span>
			</Group>
		</Stack>
	);
}