let BASE_URL = "http://localhost:5000"

function escape_query_params(params: any) {
    const esc = encodeURIComponent;
    const query = Object.keys(params)
        .map(k => esc(k) + '=' + esc(params[k]))
        .join('&');
    return query
}

export async function post<T=any>(url: string, qs: any){
    const uri = `${BASE_URL}/${url}`
    const options = {
        method: 'POST',
        body: JSON.stringify(qs),
        headers: {
            'Content-Type': 'application/json'
        }
    }

    const res = await fetch(uri, options)
    return (await res.json()) as T
}

export async function get<T=any>(url: string, qs: any={}){
    let uri = `${BASE_URL}/${url}`
    if (qs.length > 0)
        uri = `${uri}?${escape_query_params(qs)}`
    const options = {
        method: 'GET',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json'
        }
    }

    const res = await fetch(uri)
    return (await res.json()) as T
}

export default {
    get,
    post,
}
