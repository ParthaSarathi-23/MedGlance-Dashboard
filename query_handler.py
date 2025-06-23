import google.generativeai as genai
import re
import json
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Dict, Any, List
import traceback
from collections import defaultdict, Counter
import os

logger = logging.getLogger(__name__)

class DatabaseQueryHandler:
    def __init__(self, db, gemini_api_key=None):
        self.db = db
        
        # Set up Gemini
        api_key = gemini_api_key or os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
        else:
            logger.warning("No Gemini API key provided. Natural language queries will not work.")
            self.model = None
        
        # Database structure information
        self.db_structure = """
        Database Structure (Updated):
        
        📂 Collection: health_check
          🔸 Field: status (type: str)
          🔸 Field: timestamp (type: DatetimeWithNanoseconds)
        📂 Collection: unfound_drugs
          🔸 Field: tablet_name (type: str)
          🔸 Field: combination_name (type: str)
          🔸 Field: last_searched (type: DatetimeWithNanoseconds)
          🔸 Field: first_searched (type: DatetimeWithNanoseconds)
          🔸 Field: frequency (type: int)
          🔸 Field: chat_names (type: array)
        📂 Collection: users
          🔸 Field: created_at (type: DatetimeWithNanoseconds)
          🔸 Field: contact_type (type: str)
          🔸 Field: age (type: NoneType)
          🔸 Field: date_of_birth (type: NoneType)
          🔸 Field: last_updated (type: DatetimeWithNanoseconds)
          🔸 Field: is_active (type: bool)
          🔸 Field: login_count (type: int)
          🔸 Field: first_name (type: str)
          🔸 Field: last_login (type: DatetimeWithNanoseconds)
          🔸 Field: profile_complete (type: bool)
          🔸 Field: user_id (type: str)
          🔸 Field: gender (type: str)
          🔸 Field: contact (type: str)
          🔸 Field: display_name (type: str)
          🔸 Field: preferred_language (type: str)
          🔸 Field: last_name (type: str)
        📂 Collection: chats
          🔸 Field: created_at (type: DatetimeWithNanoseconds)
          🔸 Field: title (type: str)
          🔸 Field: user_id (type: str)
          🔸 Field: chat_id (type: str)
          🔸 Field: message_count (type: int)
          🔸 Field: last_updated (type: DatetimeWithNanoseconds)
        📂 Collection: conversations
          🔸 Field: message_order (type: DatetimeWithNanoseconds)
          🔸 Field: image_url (type: NoneType)
          🔸 Field: conversation_id (type: str)
          🔸 Field: bot_response (type: str)
          🔸 Field: user_message (type: str)
          🔸 Field: bot_response_tamil (type: str)
          🔸 Field: timestamp (type: DatetimeWithNanoseconds)
        
        Firebase Firestore Python SDK Usage:
        - Access collections: db.collection('collection_name')
        - Query documents: collection.where('field', '==', value)
        - Get all documents: collection.stream()
        - Collection group queries: db.collection_group('collection_name')
        - Date filtering: collection.where('timestamp', '>=', datetime_obj)
        """
    
    def generate_code_from_query(self, natural_query: str) -> Dict[str, Any]:
        """
        Generate Python code from natural language query using Google Gemini
        """
        try:
            if not self.model:
                return {
                    'success': False,
                    'error': 'Gemini API not configured. Please set GEMINI_API_KEY environment variable.',
                    'code': None,
                    'query': natural_query
                }
            
            prompt = f"""
            You are a Python code generator for Firebase Firestore queries. 
            Given a natural language query about a medical chatbot database, generate Python code that queries the database and returns the results.

            {self.db_structure}

            Rules:
            1. Use only the fields and collections mentioned in the database structure
            2. DO NOT include import statements - all modules are pre-imported (datetime, timedelta, defaultdict, Counter, etc.)
            3. The database object is already available as 'db'
            4. Return data in a format suitable for display (lists, dictionaries)
            5. Handle errors gracefully with try-except blocks
            6. Use proper Firestore query syntax
            7. For date comparisons, use datetime objects
            8. Always include comments explaining the logic
            9. Format results as JSON-serializable data structures
            10. Limit results to reasonable amounts (e.g., top 100 records)
            11. ALWAYS return a dictionary with 'data' and 'summary' keys
            12. 'data' should be a list of dictionaries for tabular display
            13. 'summary' should be a descriptive string about the results

            Available pre-imported modules:
            - datetime, timedelta (from datetime)
            - defaultdict, Counter (from collections)
            - re, json, pd (pandas), logger

            Natural Language Query: "{natural_query}"

            Generate Python code that answers this query. Return only the Python code, no explanations.
            The code should be in a function called 'execute_query()' that returns the results.
            DO NOT include any import statements.
            
            Example format:
            ```python
            def execute_query():
                try:
                    # Your query logic here (no imports needed)
                    
                    # Process data and create results list
                    data_list = [
                        {{'field1': 'value1', 'field2': 'value2'}},
                        {{'field1': 'value3', 'field2': 'value4'}}
                    ]
                    
                    results = {{
                        'data': data_list,  # Always a list of dictionaries
                        'summary': 'Found X records matching criteria'
                    }}
                    return results
                except Exception as e:
                    return {{'error': str(e), 'data': [], 'summary': 'Query failed'}}
            ```
            """
            
            response = self.model.generate_content(prompt)
            generated_code = response.text.strip()
            
            # Extract code from markdown blocks if present
            if "```python" in generated_code:
                code_match = re.search(r'```python\n(.*?)\n```', generated_code, re.DOTALL)
                if code_match:
                    generated_code = code_match.group(1)
            elif "```" in generated_code:
                code_match = re.search(r'```\n(.*?)\n```', generated_code, re.DOTALL)
                if code_match:
                    generated_code = code_match.group(1)
            
            return {
                'success': True,
                'code': generated_code,
                'query': natural_query
            }
            
        except Exception as e:
            logger.error(f"Error generating code with Gemini: {e}")
            return {
                'success': False,
                'error': str(e),
                'code': None,
                'query': natural_query
            }
    
    def execute_generated_code(self, code: str) -> Dict[str, Any]:
        """
        Safely execute the generated code and return results
        """
        try:
            # Create a safe execution environment with pre-imported modules
            safe_globals = {
                '__builtins__': {
                    # Basic Python functions
                    'len': len,
                    'range': range,
                    'enumerate': enumerate,
                    'str': str,
                    'int': int,
                    'float': float,
                    'bool': bool,
                    'list': list,
                    'dict': dict,
                    'set': set,
                    'tuple': tuple,
                    'max': max,
                    'min': min,
                    'sum': sum,
                    'round': round,
                    'sorted': sorted,
                    'any': any,
                    'all': all,
                    # Additional useful functions
                    'abs': abs,
                    'bin': bin,
                    'hex': hex,
                    'oct': oct,
                    'ord': ord,
                    'chr': chr,
                    'zip': zip,
                    'map': map,
                    'filter': filter,
                    'isinstance': isinstance,
                    'hasattr': hasattr,
                    'getattr': getattr,
                    'setattr': setattr,
                    'type': type,
                    'print': print,  # For debugging
                    'iter': iter,
                    'next': next,
                    'reversed': reversed,
                    'slice': slice,
                    'divmod': divmod,
                    'pow': pow,
                    # Exception handling
                    'Exception': Exception,
                    'ValueError': ValueError,
                    'TypeError': TypeError,
                    'KeyError': KeyError,
                    'AttributeError': AttributeError,
                    'IndexError': IndexError,
                    'RuntimeError': RuntimeError,
                    'StopIteration': StopIteration,
                    'ZeroDivisionError': ZeroDivisionError,
                    'NameError': NameError,
                },
                # Database access
                'db': self.db,
                # Pre-imported modules to avoid import statements
                'datetime': datetime,
                'timedelta': timedelta,
                'defaultdict': defaultdict,
                'Counter': Counter,
                'pd': pd,
                'json': json,
                'logger': logger,
                're': re
            }
            
            safe_locals = {}
            
            # Remove import statements from code since modules are pre-imported
            # This prevents the import error while maintaining functionality
            cleaned_code = self._clean_imports_from_code(code)
            
            # Execute the cleaned code
            exec(cleaned_code, safe_globals, safe_locals)
            
            # Call the execute_query function
            if 'execute_query' in safe_locals:
                results = safe_locals['execute_query']()
                
                # Ensure results are JSON serializable
                if isinstance(results, dict):
                    # Convert any datetime objects to strings
                    results = self._make_json_serializable(results)
                    
                    # Validate and normalize the results structure
                    results = self._normalize_results(results)
                    
                    return {
                        'success': True,
                        'results': results,
                        'executed_code': cleaned_code
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Function did not return a dictionary',
                        'executed_code': cleaned_code
                    }
            else:
                return {
                    'success': False,
                    'error': 'No execute_query function found in generated code',
                    'executed_code': cleaned_code
                }
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error executing generated code: {error_msg}")
            logger.error(f"Code that failed: {code[:200]}...")  # Log first 200 chars
            
            return {
                'success': False,
                'error': f"Execution error: {error_msg}",
                'traceback': traceback.format_exc(),
                'executed_code': code,
                'debug_info': {
                    'error_type': type(e).__name__,
                    'available_globals': list(safe_globals.keys()) if 'safe_globals' in locals() else [],
                    'code_preview': code[:200] + '...' if len(code) > 200 else code
                }
            }
    
    def _clean_imports_from_code(self, code: str) -> str:
        """
        Remove import statements from code since modules are pre-imported
        """
        lines = code.split('\n')
        cleaned_lines = []
        
        for line in lines:
            stripped_line = line.strip()
            # Skip import statements
            if (stripped_line.startswith('import ') or 
                stripped_line.startswith('from ') or
                stripped_line == ''):
                # Replace with comment to maintain line numbers for debugging
                if stripped_line and not stripped_line == '':
                    cleaned_lines.append(f"# {line}  # Pre-imported")
                else:
                    cleaned_lines.append(line)  # Keep empty lines
            else:
                cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def _normalize_results(self, results: dict) -> dict:
        """
        Normalize and validate the results structure to ensure it can be displayed
        """
        # If results is empty or has no data key, create a basic structure
        if not results or not isinstance(results, dict):
            return {
                'data': [],
                'summary': 'No results returned'
            }
        
        # Ensure we have a data key
        if 'data' not in results:
            # If we have other keys that look like data, move them to data
            possible_data_keys = ['users', 'items', 'records', 'rows', 'entries', 'results']
            data_found = False
            
            for key in possible_data_keys:
                if key in results:
                    results['data'] = results[key]
                    if key != 'data':
                        del results[key]  # Remove the old key
                    data_found = True
                    break
            
            if not data_found:
                # If it's a simple value (number, string), wrap it
                if isinstance(results, (int, float, str, bool)):
                    return {
                        'data': [{'result': results}],
                        'summary': f'Query returned: {results}'
                    }
                
                # If it's a dict with multiple keys, treat each key-value as data
                elif isinstance(results, dict):
                    data_items = []
                    for key, value in results.items():
                        if key not in ['summary', 'error']:
                            data_items.append({key: value})
                    
                    if data_items:
                        results['data'] = data_items
                    else:
                        results['data'] = []
        
        # Ensure data is a list
        if 'data' in results and not isinstance(results['data'], list):
            # If it's a single dict, wrap it in a list
            if isinstance(results['data'], dict):
                results['data'] = [results['data']]
            # If it's some other type, convert to string and wrap
            else:
                results['data'] = [{'value': str(results['data'])}]
        
        # If data is empty but we have other info, create meaningful data
        if not results.get('data'):
            if 'summary' in results:
                results['data'] = [{'summary': results['summary']}]
            else:
                results['data'] = [{'message': 'No data found for this query'}]
        
        # Ensure we have a summary
        if 'summary' not in results:
            data_count = len(results.get('data', []))
            if data_count == 0:
                results['summary'] = 'No results found'
            elif data_count == 1:
                results['summary'] = 'Found 1 result'
            else:
                results['summary'] = f'Found {data_count} results'
        
        return results
    
    def _make_json_serializable(self, obj):
        """
        Convert objects to JSON serializable format
        """
        if isinstance(obj, dict):
            return {key: self._make_json_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        elif isinstance(obj, tuple):
            return [self._make_json_serializable(item) for item in obj]
        elif isinstance(obj, datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S')
        elif hasattr(obj, '__dict__'):
            return str(obj)
        else:
            return obj
    
    def process_natural_query(self, natural_query: str) -> Dict[str, Any]:
        """
        Main function to process a natural language query
        """
        logger.info(f"Processing natural query: {natural_query}")
        
        # Generate code
        code_result = self.generate_code_from_query(natural_query)
        
        if not code_result['success']:
            return {
                'success': False,
                'error': 'Failed to generate code',
                'details': code_result,
                'query': natural_query
            }
        
        # Execute code
        execution_result = self.execute_generated_code(code_result['code'])
        
        return {
            'success': execution_result['success'],
            'query': natural_query,
            'generated_code': code_result['code'],
            'results': execution_result.get('results', {}),
            'error': execution_result.get('error'),
            'execution_details': execution_result
        }

    def get_sample_queries(self) -> List[str]:
        """
        Return sample queries that users can try
        """
        return [
            "Show me the top 10 most frequently searched unfound drugs",
            "How many users registered in the last month?",
            "What are the most common words in user messages?",
            "Show me unfound drugs searched more than 5 times",
            "What's the average number of messages per chat session?",
            "Show me the distribution of users by gender",
            "Which users have incomplete profiles?",
            "What's the hourly distribution of conversations?",
            "Show unfound drugs by their search frequency",
            "What are the latest unfound drug searches?",
            "Show me health check status distribution",
            "List all tablet names in unfound drugs",
            "Show users who speak Tamil (bot_response_tamil is not null)",
            "Which unfound drugs have combination names?"
        ]
